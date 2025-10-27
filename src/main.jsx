import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import App from "./App";
import BusinessList from "./pages/BusinessList";
import Home from "./pages/Home";
import Shop from "./pages/Shop";
import Cart from "./pages/Cart";
import Orders from "./pages/Orders";
import Auth from "./auth/Auth";
import AddMedicine from "./pages/AddMedicine"; // <-- import it
import Payment from "./pages/payment"; 
import AdminDashboard from "./pages/Admin";
import DeliveryAgent from "./pages/DeliveryAgent";
import StoreCart from "./pages/StoreCart";
import BusinessShop from "./pages/BusinessShop";
import StoreDirectory from "./pages/StoreDirectory";
import Restock from "./pages/Restock";
import Medinterface from "./pages/Medinterface";
import Navbar from "./components/Navbar";
import RedirectToLowercase from "./pages/RedirectToLowercase";
import DeliveryAgentProfile from "./pages/DeliveryAgentProfile";
import AgentsList from "./pages/AgentsList";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <>
        <Navbar />
        <LeaveStoreButton />
        <Routes>
          {/* New delivery agent profile route by slug */}
          <Route path="/agent/:slug" element={<DeliveryAgentProfile />} />
          <Route path="/agents" element={<AgentsList />} />
          <Route path="/" element={<Home />} />
          <Route path="/shop" element={<Shop />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/add-medicine" element={<AddMedicine />} />
          <Route path="/payment" element={<Payment />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/store" element={<StoreDirectory />} />
          <Route path="/store/:slug" element={<BusinessShop />} />
          <Route path="/store/:slug/cart" element={<StoreCart />} />
          <Route path="/restock" element={<Restock />} />
          <Route path="/medinterface" element={<Medinterface />} />
          <Route path="/businesses" element={<BusinessList />} />
          <Route path="/agents" element={<AgentsList />} />
        </Routes>
      </>
    </BrowserRouter>
  </React.StrictMode>
);

            function LeaveStoreButton() {
              const path = window.location.pathname;
              const storeMatch = path.match(/^\/store\/([^\/]+)/);
              const storeSlug = storeMatch ? storeMatch[1] : null;
              if (!storeSlug) return null;
              return (
                <button
                  onClick={() => window.location.href = "/shop"}
                  style={{
                    position: "fixed",
                    top: "80px",
                    left: "32px",
                    background: "#fff",
                    color: "#7c3aed",
                    border: "1px solid #7c3aed",
                    borderRadius: "50px",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.10)",
                    padding: "4px 10px",
                    fontWeight: "bold",
                    fontSize: "13px",
                    zIndex: 1000,
                    cursor: "pointer",
                    transition: "box-shadow 0.2s",
                    opacity: 0.96,
                  }}
                  onMouseOver={e => e.currentTarget.style.boxShadow = "0 4px 16px rgba(124,58,237,0.18)"}
                  onMouseOut={e => e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.10)"}
                >
                  Leave Store
                </button>
              );
}
