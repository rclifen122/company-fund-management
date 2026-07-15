export const buildMonthAllocations = (months, monthlyAmount, totalAmount, extraMonths) => {
  const allocations = Object.fromEntries(months.map((monthKey) => [monthKey, monthlyAmount]));
  const extraAmount = Math.max(totalAmount - (months.length * monthlyAmount), 0);
  const eligibleMonths = extraMonths.filter((monthKey) => months.includes(monthKey));

  if (extraAmount === 0 || eligibleMonths.length === 0) return allocations;

  const sharedExtra = Math.floor(extraAmount / eligibleMonths.length);
  const remainder = extraAmount % eligibleMonths.length;
  eligibleMonths.forEach((monthKey, index) => {
    allocations[monthKey] += sharedExtra + (index < remainder ? 1 : 0);
  });

  return allocations;
};
