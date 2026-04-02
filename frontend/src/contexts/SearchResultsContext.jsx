import { createContext, useContext, useState, useCallback } from "react";

const SearchResultsContext = createContext(null);

export function SearchResultsProvider({ children }) {
  const [channels, setChannels] = useState([]);
  const [rawSearchResults, setRawSearchResults] = useState(null);
  const [searchMetadata, setSearchMetadata] = useState(null);

  const clearResults = useCallback(() => {
    setChannels([]);
    setRawSearchResults(null);
    setSearchMetadata(null);
    sessionStorage.removeItem("affi_channels");
    sessionStorage.removeItem("affi_raw");
    sessionStorage.removeItem("affi_meta");
  }, []);

  const persistToSession = useCallback((ch, raw, meta) => {
    try {
      if (ch?.length) sessionStorage.setItem("affi_channels", JSON.stringify(ch));
      if (raw) sessionStorage.setItem("affi_raw", JSON.stringify(raw));
      if (meta) sessionStorage.setItem("affi_meta", JSON.stringify(meta));
    } catch (e) {
      console.error("Failed to persist to session:", e);
    }
  }, []);

  const restoreFromSession = useCallback(() => {
    try {
      const ch = sessionStorage.getItem("affi_channels");
      const raw = sessionStorage.getItem("affi_raw");
      const meta = sessionStorage.getItem("affi_meta");
      if (ch) setChannels(JSON.parse(ch));
      if (raw) setRawSearchResults(JSON.parse(raw));
      if (meta) setSearchMetadata(JSON.parse(meta));
      return !!ch;
    } catch (e) {
      return false;
    }
  }, []);

  const updateChannels = useCallback((ch) => {
    setChannels(ch);
    try { sessionStorage.setItem("affi_channels", JSON.stringify(ch)); } catch {}
  }, []);

  const updateRawResults = useCallback((raw) => {
    setRawSearchResults(raw);
    try { if (raw) sessionStorage.setItem("affi_raw", JSON.stringify(raw)); } catch {}
  }, []);

  const updateMetadata = useCallback((meta) => {
    setSearchMetadata(meta);
    try { if (meta) sessionStorage.setItem("affi_meta", JSON.stringify(meta)); } catch {}
  }, []);

  return (
    <SearchResultsContext.Provider value={{
      channels, setChannels: updateChannels,
      rawSearchResults, setRawSearchResults: updateRawResults,
      searchMetadata, setSearchMetadata: updateMetadata,
      clearResults, persistToSession, restoreFromSession
    }}>
      {children}
    </SearchResultsContext.Provider>
  );
}

export const useSearchResults = () => useContext(SearchResultsContext);
