import type { SiteDefinition } from "@/lib/site-contract";
import { HomePage } from "./pages/home";
import { WorkPage } from "./pages/work";
import { WorkDetailPage } from "./pages/work-detail";
import { AboutPage } from "./pages/about";
import { ContactPage } from "./pages/contact";
import { getHealth } from "./api/health";
import { getMessages, postMessage } from "./api/messages";
import { findProject } from "./lib/projects";
import { siteStyles } from "./styles";

/**
 * Meridian Studio — route table consumed by the platform dispatcher.
 * Patterns support static segments, [params], and [...catchAll].
 */
export const site: SiteDefinition = {
  routes: [
    {
      path: "/",
      component: HomePage,
      metadata: {
        title: "Meridian Studio — Architecture & Interiors",
        description:
          "An architecture and interiors studio in Copenhagen designing buildings of few moves and lasting materials.",
      },
    },
    {
      path: "/work",
      component: WorkPage,
      metadata: {
        title: "Work — Meridian Studio",
        description: "Selected buildings by Meridian Studio, 2019–2025.",
      },
    },
    {
      path: "/work/[slug]",
      component: WorkDetailPage,
      metadata: ({ params }) => {
        const project = findProject(params.slug ?? "");
        return {
          title: project ? `${project.title} — Meridian Studio` : "Project — Meridian Studio",
          description: project?.summary ?? "A Meridian Studio project.",
        };
      },
    },
    {
      path: "/about",
      component: AboutPage,
      metadata: {
        title: "Studio — Meridian Studio",
        description: "A small Copenhagen studio for buildings that stay out of the way.",
      },
    },
    {
      path: "/contact",
      component: ContactPage,
      metadata: {
        title: "Contact — Meridian Studio",
        description: "Start a project with Meridian Studio — no login required.",
      },
    },
  ],
  api: [
    { path: "/health", handlers: { GET: getHealth } },
    { path: "/messages", handlers: { GET: getMessages, POST: postMessage } },
  ],
  styles: siteStyles,
};
