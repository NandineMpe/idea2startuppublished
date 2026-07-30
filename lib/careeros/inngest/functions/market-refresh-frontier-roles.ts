import { refreshMarketFrontierRoleSnapshots } from "@/lib/careeros/market/frontier-roles"
import { careerosInngest } from "../client"

export const marketRefreshFrontierRoles = careerosInngest.createFunction(
  {
    id: "careeros-market-refresh-frontier-roles",
    name: "CareerOS market.refresh-frontier-roles",
    retries: 1,
    triggers: [{ event: "careeros/market.refresh-frontier-roles" }],
  },
  async ({ step }) => {
    return step.run("refresh-frontier", async () => refreshMarketFrontierRoleSnapshots())
  },
)
