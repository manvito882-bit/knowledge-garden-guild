import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

// After an update, old page code may point to files that no longer exist — reload once to get fresh ones.
if (typeof window !== "undefined") {
  window.addEventListener("vite:preloadError", (e) => {
    if (sessionStorage.getItem("chunk-reload")) return;
    sessionStorage.setItem("chunk-reload", "1");
    e.preventDefault();
    window.location.reload();
  });
  window.addEventListener("load", () => setTimeout(() => sessionStorage.removeItem("chunk-reload"), 10000));
}

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
