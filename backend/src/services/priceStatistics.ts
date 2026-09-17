export interface PriceObservation {
  priceDate: Date;
  modalPrice: number | null;
}

export const calculatePriceStatistics = (observations: PriceObservation[]) => {
  const modalPrices = observations
    .map((observation) => observation.modalPrice)
    .filter((price): price is number => price !== null && Number.isFinite(price));
  const ordered = observations
    .filter((observation): observation is PriceObservation & { modalPrice: number } => observation.modalPrice !== null && Number.isFinite(observation.modalPrice))
    .sort((left, right) => left.priceDate.getTime() - right.priceDate.getTime());
  const first = ordered[0]?.modalPrice ?? null;
  const latest = ordered.at(-1)?.modalPrice ?? null;
  const change = first !== null && latest !== null ? latest - first : null;
  return {
    minimumPrice: modalPrices.length ? Math.min(...modalPrices) : null,
    maximumPrice: modalPrices.length ? Math.max(...modalPrices) : null,
    averageModalPrice: modalPrices.length ? modalPrices.reduce((sum, price) => sum + price, 0) / modalPrices.length : null,
    observationCount: observations.length,
    firstModalPrice: first,
    latestModalPrice: latest,
    absoluteChange: change,
    percentageChange: first && change !== null ? (change / first) * 100 : null,
  };
};
