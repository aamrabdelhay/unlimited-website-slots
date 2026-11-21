import type { SiteDefinition } from "@/lib/site-contract";
import { HomePage } from "./pages/home";
import { carsRoute, alertsRoute } from "./api/route";
export const site: SiteDefinition = {
 routes: [{path:"/",component:HomePage,metadata:{title:"I've arrived, sir",description:"Contact a car owner privately using a QR code."}}],
 api: [carsRoute,alertsRoute],
};
