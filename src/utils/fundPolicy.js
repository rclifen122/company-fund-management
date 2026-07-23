// Sau ngày này trong tháng, nhân viên chưa nộp quỹ được coi là quá hạn.
export const FUND_DUE_DAY = 15;

const monthKeyOf = (value) => {
  const match = String(value || '').match(/^(\d{4})-(\d{2})/);
  return match ? `${match[1]}-${match[2]}` : null;
};

// Tháng đầu tiên nhân viên phải đóng quỹ: ưu tiên fund_start_date (V14),
// dữ liệu cũ chưa có thì lấy tháng của join_date.
export const getFundStartMonthKey = (employee) => (
  monthKeyOf(employee?.fund_start_date) || monthKeyOf(employee?.join_date)
);

// Nhân viên chưa nộp monthKey có bị coi là quá hạn không.
// Tháng trước tháng bắt đầu đóng thì không bị tính; tháng hiện tại chỉ quá hạn
// sau ngày FUND_DUE_DAY, và người vào quỹ sau hạn nộp của chính tháng đó thì
// tháng đầu chỉ là "chờ nộp".
export const isMonthOverdue = (employee, monthKey, currentMonthKey, today = new Date()) => {
  const startMonthKey = getFundStartMonthKey(employee);
  if (startMonthKey && monthKey < startMonthKey) return false;
  if (monthKey > currentMonthKey) return false;
  if (monthKey < currentMonthKey) return true;
  if (today.getDate() <= FUND_DUE_DAY) return false;
  const joinDay = Number(String(employee?.join_date || '').slice(8, 10));
  if (monthKeyOf(employee?.join_date) === monthKey && joinDay > FUND_DUE_DAY) return false;
  return true;
};

// Gợi ý tháng bắt đầu đóng khi thêm nhân viên: vào sau ngày FUND_DUE_DAY
// thì bắt đầu từ tháng kế tiếp. Trả về chuỗi YYYY-MM cho input type="month".
export const suggestFundStartMonth = (joinDate) => {
  const match = String(joinDate || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return '';
  let year = Number(match[1]);
  let month = Number(match[2]);
  if (Number(match[3]) > FUND_DUE_DAY) {
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return `${year}-${String(month).padStart(2, '0')}`;
};

// Dữ liệu cũ có thể thiếu months_covered (constraint V10 là NOT VALID),
// khi đó tháng nộp được suy ra từ payment_date. Mọi nơi tính "tháng đã nộp"
// phải dùng chung helper này để các trang không lệch nhau.
export const getCoveredMonthKeys = (payment) => (
  Array.isArray(payment.months_covered) && payment.months_covered.length > 0
    ? payment.months_covered
    : [String(payment.payment_date || '').slice(0, 7)].filter(Boolean)
);
