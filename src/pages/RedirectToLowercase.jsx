import { useParams, Navigate } from "react-router-dom";

export default function RedirectToLowercase() {
  const { slug } = useParams();
  return <Navigate to={`/deliveryagent/${slug}`} replace />;
}