export interface MemberAcceptedPayload {
  organizationId: string;
  userId: string;
  email: string;
  name: string;
  phone: string | null;
  role: string;
}

export const MemberAcceptedBridge = {
  handler: null as null | ((payload: MemberAcceptedPayload) => Promise<void>),
};
