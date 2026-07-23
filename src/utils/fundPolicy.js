// Sau ngày này trong tháng, nhân viên chưa nộp quỹ được coi là quá hạn.
export const FUND_DUE_DAY = 15;

// Dữ liệu cũ có thể thiếu months_covered (constraint V10 là NOT VALID),
// khi đó tháng nộp được suy ra từ payment_date. Mọi nơi tính "tháng đã nộp"
// phải dùng chung helper này để các trang không lệch nhau.
export const getCoveredMonthKeys = (payment) => (
  Array.isArray(payment.months_covered) && payment.months_covered.length > 0
    ? payment.months_covered
    : [String(payment.payment_date || '').slice(0, 7)].filter(Boolean)
);
