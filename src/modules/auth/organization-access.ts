export function canCreateOrganization(
  membershipRoles: readonly string[],
): boolean {
  if (membershipRoles.length === 0) {
    return true;
  }
  return membershipRoles.includes('owner');
}
