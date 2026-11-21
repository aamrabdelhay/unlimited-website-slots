import type { SiteApiRoute } from "@/lib/site-contract";
import { listCars, createCar, createAlert, replyAlert } from "./cars";
export const carsRoute: SiteApiRoute = {path:"/cars",handlers:{GET:listCars,POST:createCar}};
export const alertsRoute: SiteApiRoute = {path:"/alerts",handlers:{POST:createAlert,PATCH:replyAlert}};
