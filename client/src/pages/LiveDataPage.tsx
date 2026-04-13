import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import SensorPage from "./SensorPage";

/**
 * Live-only view that ensures the query param mode=live is applied
 * so the base SensorPage renders live behavior without duplicating logic.
 */
export default function LiveDataPage() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("mode") !== "live") {
      params.set("mode", "live");
      navigate(
        { pathname: location.pathname, search: params.toString() },
        { replace: true }
      );
    }
  }, [location.pathname, location.search, navigate]);

  return <SensorPage />;
}
