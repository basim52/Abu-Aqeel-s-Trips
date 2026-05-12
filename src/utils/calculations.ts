import { Settlement, Expense, Contribution } from '../types';

export function calculateSettlements(members: string[], expenses: Expense[], contributions: Contribution[]): Settlement[] {
  if (members.length === 0) return [];

  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const costPerPerson = totalExpenses / members.length;

  // Calculate net balance for each member
  // Positive: they are owed money (or have a surplus contribution/expense payment)
  // Negative: they owe money
  const balances: Record<string, number> = {};
  
  members.forEach(m => {
    // Each member starts with their share of the total cost as a debt
    balances[m] = -costPerPerson;
    
    // Credit what they paid directly as expenses
    const paidExpenses = expenses
      .filter(e => e.paidBy === m)
      .reduce((sum, e) => sum + e.amount, 0);
    balances[m] += paidExpenses;
    
    // Credit what they paid into the pot
    const paidContributions = contributions
      .filter(c => c.memberName === m)
      .reduce((sum, c) => sum + c.amount, 0);
    balances[m] += paidContributions;
  });

  const creditors = members
    .filter(m => balances[m] > 0.01)
    .sort((a, b) => balances[b] - balances[a]);
  
  const debtors = members
    .filter(m => balances[m] < -0.01)
    .sort((a, b) => balances[a] - balances[b]);

  const settlements: Settlement[] = [];

  let i = 0; // debtor index
  let j = 0; // creditor index

  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i];
    const creditor = creditors[j];
    
    const amountToPay = Math.min(-balances[debtor], balances[creditor]);
    
    if (amountToPay > 0.01) {
      settlements.push({
        from: debtor,
        to: creditor,
        amount: Number(amountToPay.toFixed(2))
      });
    }

    balances[debtor] += amountToPay;
    balances[creditor] -= amountToPay;

    if (Math.abs(balances[debtor]) < 0.01) i++;
    if (Math.abs(balances[creditor]) < 0.01) j++;
  }

  return settlements;
}
