import type { SiteDefinition } from "@/lib/site-contract";
import { HomePage } from "./pages/home";
import { siteStyles } from "./styles";

export const site: SiteDefinition = {
  routes: [
    {
      path: "/",
      component: HomePage,
      metadata: {
        title: "Reserved Slot 127",
        description: "Empty placeholder proving sparse slot ids route correctly.",
      },
    },
  ],
  api: [],
  styles: siteStyles,
};
