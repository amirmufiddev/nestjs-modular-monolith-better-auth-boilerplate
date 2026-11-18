export function buildInvitationLink(input: {
  invitationId: string;
  inviteURL: string;
}): string {
  return `${input.inviteURL}/${input.invitationId}`;
}
