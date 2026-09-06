import { useEffect, useState } from "react";
import { PageId } from "./types";

const PAGES: PageId[] = ["predictor", "used-homes", "image-valuation", "pipeline", "metrics"];
const DEFAULT_PAGE: PageId = "predictor";

function readHash(): PageId {
  const id = window.location.hash.replace(/^#\/?/, "");
  return PAGES.includes(id as PageId) ? (id as PageId) : DEFAULT_PAGE;
}

/** Keeps the active page in the URL so refresh, deep links and Back all work. */
export function useHashRoute(): [PageId, (page: PageId) => void] {
  const [page, setPage] = useState<PageId>(readHash);

  useEffect(() => {
    const onHashChange = () => setPage(readHash());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const navigate = (next: PageId) => {
    window.location.hash = `/${next}`;
  };

  return [page, navigate];
}
