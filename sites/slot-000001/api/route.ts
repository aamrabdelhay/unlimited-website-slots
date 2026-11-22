import type { SiteApiRoute } from "@/lib/site-contract";
import { listCars, createCar, createAlert, getAlert, replyAlert, getPushConfig, getPushServiceWorker, registerPushSubscription } from "./cars";
export const carsRoute: SiteApiRoute = {path:"/cars",handlers:{GET:listCars,POST:createCar}};
export const alertsRoute: SiteApiRoute = {path:"/alerts",handlers:{GET:getAlert,POST:createAlert,PATCH:replyAlert}};

export const pushConfigRoute: SiteApiRoute = {path:"/push-config",handlers:{GET:getPushConfig}};
export const pushServiceWorkerRoute: SiteApiRoute = {path:"/push-sw",handlers:{GET:getPushServiceWorker}};
export const pushSubscriptionsRoute: SiteApiRoute = {path:"/push-subscriptions",handlers:{POST:registerPushSubscription}};
