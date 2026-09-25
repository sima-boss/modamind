/** Fired whenever the current user's subscription changes (checkout,
 * upgrade, downgrade, cancel, renewal), so already-mounted components
 * like the navbar's plan badge can refetch without a full page reload. */
export const SUBSCRIPTION_CHANGED_EVENT = "fashnix:subscription-changed";
