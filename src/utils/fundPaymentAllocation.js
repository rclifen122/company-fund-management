export const buildMonthAllocations = (months, monthlyAmount, totalAmount, extraMonths) => {
  const allocations = Object.fromEntries(months.map((monthKey) => [monthKey, monthlyAmount]));
  const extraAmount = Math.max(totalAmount - (months.length * monthlyAmount), 0);
  if (extraAmount === 0 || months.length === 0) return allocations;

  // Không được làm rơi tiền dư: nếu không chọn tháng nhận thì dồn vào tháng cuối
  // để tổng phân bổ luôn bằng tổng tiền đã nộp.
  const eligibleMonths = extraMonths.filter((monthKey) => months.includes(monthKey));
  if (eligibleMonths.length === 0) {
    allocations[months[months.length - 1]] += extraAmount;
    return allocations;
  }

  const sharedExtra = Math.floor(extraAmount / eligibleMonths.length);
  const remainder = extraAmount % eligibleMonths.length;
  eligibleMonths.forEach((monthKey, index) => {
    allocations[monthKey] += sharedExtra + (index < remainder ? 1 : 0);
  });

  return allocations;
};
