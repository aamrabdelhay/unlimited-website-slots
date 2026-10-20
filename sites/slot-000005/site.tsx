import type { SiteDefinition } from "@/lib/site-contract";
import { HomePage } from "./pages/home";
import { siteStyles } from "./styles";

export const site: SiteDefinition = {
  routes: [
    {
      path: "/",
      component: HomePage,
      metadata: {
        title: "Law Firm Demo",
        description: "Throwaway slot used to verify the extraction workflow end-to-end.",
      },
    },
  ],
  api: [],
  styles: siteStyles,
};
