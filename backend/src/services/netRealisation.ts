import { Prisma } from '@prisma/client';

export type NetRealisationInput = {
  saleQuantity: string;
  saleQuantityUnit: 'KG' | 'QUINTAL' | 'TON';
  salePricePerQuintal: string;
  transportCost?: string;
  storageCost?: string;
  commissionCost?: string;
  commissionRate?: string;
  packagingCost?: string;
  expectedLossPercentage?: string;
  otherCosts?: string;
};

const decimal = (value = '0') => new Prisma.Decimal(value);
const rounded = (value: Prisma.Decimal) => value.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

export const quantityToQuintals = (quantity: Prisma.Decimal, unit: 'KG' | 'QUINTAL' | 'TON') =>
  unit === 'KG' ? quantity.div(100) : unit === 'TON' ? quantity.mul(10) : quantity;

export const calculateNetRealisation = (input: NetRealisationInput) => {
  const quantity = decimal(input.saleQuantity);
  const quantityQuintals = quantityToQuintals(quantity, input.saleQuantityUnit);
  const salePricePerQuintal = decimal(input.salePricePerQuintal);
  const saleRevenue = quantityQuintals.mul(salePricePerQuintal);
  const commissionCost = input.commissionRate
    ? saleRevenue.mul(decimal(input.commissionRate)).div(100)
    : decimal(input.commissionCost);
  const expectedLossCost = saleRevenue.mul(decimal(input.expectedLossPercentage)).div(100);
  const transportCost = decimal(input.transportCost);
  const storageCost = decimal(input.storageCost);
  const packagingCost = decimal(input.packagingCost);
  const otherCosts = decimal(input.otherCosts);
  const totalCosts = transportCost
    .add(storageCost)
    .add(commissionCost)
    .add(packagingCost)
    .add(expectedLossCost)
    .add(otherCosts);
  const netRealisation = saleRevenue.sub(totalCosts);

  return {
    saleQuantity: quantity,
    saleQuantityUnit: input.saleQuantityUnit,
    saleQuantityQuintals: quantityQuintals,
    salePricePerQuintal,
    saleRevenue: rounded(saleRevenue),
    transportCost: rounded(transportCost),
    storageCost: rounded(storageCost),
    commissionCost: rounded(commissionCost),
    packagingCost: rounded(packagingCost),
    expectedLossPercentage: decimal(input.expectedLossPercentage),
    expectedLossCost: rounded(expectedLossCost),
    otherCosts: rounded(otherCosts),
    totalCosts: rounded(totalCosts),
    netRealisation: rounded(netRealisation),
  };
};

export const decimalStrings = (result: ReturnType<typeof calculateNetRealisation>) =>
  Object.fromEntries(
    Object.entries(result).map(([key, value]) => [key, value instanceof Prisma.Decimal ? value.toString() : value]),
  );
