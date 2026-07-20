const toAmount = (value) => Number(value || 0);

export const summarizePendingBillFinancials = (bills = []) => {
  const paidDirectByExpense = new Map();
  let paidDirectTotal = 0;
  let outstandingDirectTotal = 0;

  bills.forEach((bill) => {
    const directParticipants = (bill.bill_sharing_participants || [])
      .filter((participant) => participant.payment_method === 'direct');
    const directOwed = directParticipants.reduce(
      (sum, participant) => sum + toAmount(participant.amount_owed),
      0
    );
    const directPaid = directParticipants
      .filter((participant) => participant.payment_status === 'paid')
      .reduce((sum, participant) => sum + toAmount(participant.amount_owed), 0);
    const linkedExpenses = bill.bill_sharing_expenses || [];
    const linkedTotal = linkedExpenses.reduce(
      (sum, expense) => sum + toAmount(expense.amount),
      0
    );

    paidDirectTotal += directPaid;
    outstandingDirectTotal += Math.max(0, directOwed - directPaid);

    if (directPaid <= 0 || linkedTotal <= 0) return;

    const paidDirectCents = Math.round(directPaid * 100);
    let remainingPaidCents = paidDirectCents;
    linkedExpenses.forEach((expense, index) => {
      const proportionalPaidCents = Math.round(
        (toAmount(expense.amount) / linkedTotal) * paidDirectCents
      );
      const paidCents = index === linkedExpenses.length - 1
        ? remainingPaidCents
        : Math.min(remainingPaidCents, proportionalPaidCents);
      remainingPaidCents -= paidCents;
      const roundedPaid = paidCents / 100;
      paidDirectByExpense.set(
        expense.expense_id,
        (paidDirectByExpense.get(expense.expense_id) || 0) + roundedPaid
      );
    });
  });

  return {
    paidDirectByExpense,
    paidDirectTotal,
    outstandingDirectTotal,
  };
};
