import { useEffect, useState } from "react";

/** Minimal hash-based route hook (no router dependency).
 * Route is the string after '#', defaulting to 'cases'. */
export function useHashRoute(): [string, (to: string) => void] {
  const read = () => (window.location.hash.replace(/^#\/?/, "") || "cases");
  const [route, setRoute] = useState<string>(read());

  useEffect(() => {
    const onChange = () => setRoute(read());
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);

  const navigate = (to: string) => {
    window.location.hash = `/${to.replace(/^#?\/?/, "")}`;
  };
  return [route, navigate];
}

/** First path segment, e.g. 'cases/552-01' -> 'cases'. */
export function routeSegment(route: string): string {
  return route.split("/")[0];
}
