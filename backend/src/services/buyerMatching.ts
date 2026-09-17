import { Prisma } from '@prisma/client';

export type MatchingLot = {
  id: string;
  cropId: string;
  quantity: Prisma.Decimal;
  quantityUnit: 'KG' | 'QUINTAL' | 'TON';
  status: string;
  qualityGrade: string | null;
  qualityNotes: string | null;
  farm: { state: string | null; district: string | null };
};

export type MatchingDemand = {
  id: string;
  cropId: string;
  quantity: Prisma.Decimal;
  quantityUnit: 'KG' | 'QUINTAL' | 'TON';
  minimumQuantity: Prisma.Decimal | null;
  preferredMarketId: string | null;
  preferredState: string | null;
  preferredDistrict: string | null;
  qualityRequirement: string | null;
  minimumPrice: Prisma.Decimal | null;
  maximumPrice: Prisma.Decimal | null;
  validFrom: Date;
  validUntil: Date | null;
  status: string;
  buyer: { id: string; businessName: string; buyerType: string; status: string };
};

export type MatchingMarketPrice = {
  marketId: string;
  cropId: string;
  modalPrice: Prisma.Decimal | null;
  normalizedUnit: string;
  priceDate: Date;
  source: string;
  sourceType: string;
};

const quantityToQuintals = (quantity: Prisma.Decimal, unit: MatchingLot['quantityUnit']) =>
  unit === 'KG' ? quantity.div(100) : unit === 'TON' ? quantity.mul(10) : quantity;

export const evaluateBuyerDemandMatch = (
  lot: MatchingLot,
  demand: MatchingDemand,
  evaluatedAt: Date,
  marketPrice?: MatchingMarketPrice,
) => {
  const reasons: string[] = [];
  let eligible = true;
  const lotQuantity = quantityToQuintals(lot.quantity, lot.quantityUnit);
  const demandQuantity = quantityToQuintals(demand.quantity, demand.quantityUnit);
  const minimumRequiredQuantity = demand.minimumQuantity
    ? quantityToQuintals(demand.minimumQuantity, demand.quantityUnit)
    : demandQuantity;

  if (lot.status === 'READY_FOR_MARKET') reasons.push('LOT_ELIGIBLE');
  else {
    reasons.push('LOT_NOT_ELIGIBLE');
    eligible = false;
  }
  if (lot.cropId === demand.cropId) reasons.push('CROP_MATCH');
  else {
    reasons.push('CROP_MISMATCH');
    eligible = false;
  }
  if (demand.buyer.status === 'ACTIVE') reasons.push('BUYER_ACTIVE');
  else {
    reasons.push('BUYER_NOT_ACTIVE');
    eligible = false;
  }
  if (demand.status === 'ACTIVE') reasons.push('DEMAND_ACTIVE');
  else {
    reasons.push('DEMAND_NOT_ACTIVE');
    eligible = false;
  }
  if (demand.validFrom <= evaluatedAt && (demand.validUntil === null || demand.validUntil >= evaluatedAt)) reasons.push('DEMAND_VALID');
  else {
    reasons.push('DEMAND_EXPIRED');
    eligible = false;
  }
  if (lotQuantity.gte(minimumRequiredQuantity)) reasons.push('QUANTITY_MATCH');
  else {
    reasons.push('QUANTITY_INSUFFICIENT');
    eligible = false;
  }

  const qualityRequired = Boolean(demand.qualityRequirement?.trim());
  let qualityEligible = true;
  if (!qualityRequired) reasons.push('QUALITY_NOT_SPECIFIED');
  else if (!lot.qualityGrade) {
    reasons.push('QUALITY_INFORMATION_INSUFFICIENT');
    qualityEligible = false;
    eligible = false;
  } else if (lot.qualityGrade.trim().toLowerCase() === demand.qualityRequirement!.trim().toLowerCase()) {
    reasons.push('QUALITY_MATCH');
  } else {
    reasons.push('QUALITY_MISMATCH');
    qualityEligible = false;
    eligible = false;
  }

  let locationEligible = true;
  const locationReasons: string[] = [];
  if (demand.preferredState || demand.preferredDistrict) {
    const stateMatches = !demand.preferredState || demand.preferredState.toLowerCase() === lot.farm.state?.toLowerCase();
    const districtMatches = !demand.preferredDistrict || demand.preferredDistrict.toLowerCase() === lot.farm.district?.toLowerCase();
    if (stateMatches && districtMatches) {
      reasons.push('LOCATION_MATCH');
      locationReasons.push('LOCATION_MATCH');
    } else {
      reasons.push('LOCATION_MISMATCH');
      locationReasons.push('LOCATION_MISMATCH');
      locationEligible = false;
      eligible = false;
    }
  } else if (demand.preferredMarketId) {
    reasons.push('LOCATION_INFORMATION_INSUFFICIENT');
    locationReasons.push('LOCATION_INFORMATION_INSUFFICIENT');
    locationEligible = false;
    eligible = false;
  } else {
    reasons.push('LOCATION_NOT_SPECIFIED');
    locationReasons.push('LOCATION_NOT_SPECIFIED');
  }

  let priceCompatible = true;
  let priceApplicable = false;
  if (demand.minimumPrice !== null || demand.maximumPrice !== null) {
    priceApplicable = true;
    if (!marketPrice || marketPrice.modalPrice === null || marketPrice.normalizedUnit !== 'INR_PER_QUINTAL') {
      reasons.push('PRICE_INFORMATION_INSUFFICIENT');
      priceCompatible = false;
      eligible = false;
    } else {
      const aboveMinimum = demand.minimumPrice === null || marketPrice.modalPrice.gte(demand.minimumPrice);
      const belowMaximum = demand.maximumPrice === null || marketPrice.modalPrice.lte(demand.maximumPrice);
      if (aboveMinimum && belowMaximum) reasons.push('PRICE_WITHIN_RANGE');
      else {
        reasons.push('PRICE_OUTSIDE_RANGE');
        priceCompatible = false;
        eligible = false;
      }
    }
  } else {
    reasons.push('PRICE_CONSTRAINT_NOT_SPECIFIED');
  }

  return {
    buyerId: demand.buyer.id,
    buyerName: demand.buyer.businessName,
    buyerType: demand.buyer.buyerType,
    demandId: demand.id,
    cropId: demand.cropId,
    eligible,
    quantity: {
      lotQuantity: lotQuantity.toString(),
      demandQuantity: demandQuantity.toString(),
      minimumRequiredQuantity: minimumRequiredQuantity.toString(),
      normalizedUnit: 'QUINTAL',
    },
    quality: { eligible: qualityEligible, reasons: qualityRequired ? reasons.filter((reason) => reason.startsWith('QUALITY_')) : ['QUALITY_NOT_SPECIFIED'] },
    location: { eligible: locationEligible, reasons: locationReasons },
    price: {
      applicable: priceApplicable,
      compatible: priceCompatible,
      marketPrice: marketPrice?.modalPrice?.toString() ?? null,
      minimumPrice: demand.minimumPrice?.toString() ?? null,
      maximumPrice: demand.maximumPrice?.toString() ?? null,
      priceDate: marketPrice?.priceDate ?? null,
      source: marketPrice?.source ?? null,
      sourceType: marketPrice?.sourceType ?? null,
    },
    reasons,
  };
};
