export const EMPLOYEE_MEMBERSHIP = {
  FUND: 'fund',
  DIRECT: 'direct',
  INACTIVE: 'inactive',
};

export const getEmployeeMembershipMode = (employee) => {
  if (!employee || employee.status === 'inactive' || employee.leave_date) {
    return EMPLOYEE_MEMBERSHIP.INACTIVE;
  }

  return employee.participates_in_fund === false
    ? EMPLOYEE_MEMBERSHIP.DIRECT
    : EMPLOYEE_MEMBERSHIP.FUND;
};

export const isActiveFundMember = (employee) => (
  getEmployeeMembershipMode(employee) === EMPLOYEE_MEMBERSHIP.FUND
);

export const getMembershipUpdate = (mode) => {
  if (mode === EMPLOYEE_MEMBERSHIP.FUND) {
    return {
      status: 'active',
      leave_date: null,
      participates_in_fund: true,
    };
  }

  if (mode === EMPLOYEE_MEMBERSHIP.DIRECT) {
    return {
      status: 'active',
      leave_date: null,
      participates_in_fund: false,
    };
  }

  return {
    status: 'inactive',
    participates_in_fund: false,
  };
};
