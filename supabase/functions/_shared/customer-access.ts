export type CustomerAccessFailure = 'internal_admin_account' | 'customer_not_in_branch';

/** Return a failure code before a customer profile or account action is exposed. */
export function getCustomerAccessFailure(isAdminAccount: boolean, hasSelectedBranchRecord: boolean): CustomerAccessFailure | null {
  if (isAdminAccount) return 'internal_admin_account';
  if (!hasSelectedBranchRecord) return 'customer_not_in_branch';
  return null;
}
