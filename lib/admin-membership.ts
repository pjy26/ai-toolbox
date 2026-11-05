import { membershipTier, type MembershipTier } from "@/lib/membership-plans";

type MembershipRow = {
  membership_type: string | null;
  membership_expires_at: string | null;
  manual_membership_type: string | null;
  manual_membership_expires_at: string | null;
};

export function activeMembershipTier(row: MembershipRow | null | undefined, now = new Date()): MembershipTier {
  if (!row) return "free";
  const paidActive = row.membership_type && row.membership_type !== "free" && row.membership_expires_at && Date.parse(row.membership_expires_at) > now.getTime();
  const manualActive = row.manual_membership_type && row.manual_membership_expires_at && Date.parse(row.manual_membership_expires_at) > now.getTime();
  if (manualActive && (!paidActive || Date.parse(row.manual_membership_expires_at!) > Date.parse(row.membership_expires_at!))) {
    return membershipTier(row.manual_membership_type);
  }
  return paidActive ? membershipTier(row.membership_type) : "free";
}

export async function getAdminMembershipTier(admin: any, userId: string, now = new Date()): Promise<MembershipTier> {
  const { data, error } = await admin.from("profiles")
    .select("membership_type, membership_expires_at, manual_membership_type, manual_membership_expires_at")
    .eq("id", userId).maybeSingle();
  if (error) throw new Error(`Could not verify membership: ${error.message}`);
  return activeMembershipTier(data, now);
}
