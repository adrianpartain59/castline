import { useEffect, useState } from "react";
import Landing from "./pages/Landing";
import Studio from "./pages/Studio";

// Hash routing so the site works from GitHub Pages with no server rewrites.
function useRoute(): string {
  const [route, setRoute] = useState(() => window.location.hash.replace(/^#/, "") || "/");
  useEffect(() => {
    const onHash = () => {
      setRoute(window.location.hash.replace(/^#/, "") || "/");
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  return route;
}

export default function App() {
  const route = useRoute();
  return route.startsWith("/studio") ? <Studio /> : <Landing />;
}
