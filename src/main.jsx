import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import App from "./App";
import Home from "./pages/Home";
import Shop from "./pages/Shop";
import Cart from "./pages/Cart";
import Orders from "./pages/Orders";
import Auth from "./auth/Auth";
import AddMedicine from "./pages/AddMedicine"; // <-- import it
import Payment from "./pages/payment"; 
import AdminDashboard from "./pages/Admin";
import BusinessShop from "./pages/BusinessShop";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <nav 
        style={{ 
          display: "flex", 
          gap: "20px", 
          padding: "20px", 
          background: "#f8f8f8",
          borderBottom: "1px solid #ddd",
        }}
      >
        <Link to="/">Home</Link>
        <Link to="/shop">Shop</Link>
        <Link to="/cart">Cart</Link>
        <Link to="/auth">Auth</Link>
        <Link to="/orders">Orders</Link>
        <Link to="/add-medicine">Add Medicine</Link> {/* <-- new link */}
        <Link to="/admin">Admin</Link>

      </nav>

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/shop" element={<Shop />} />
        <Route path="/cart" element={<Cart />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/orders" element={<Orders />} />
        <Route path="/add-medicine" element={<AddMedicine />} />
        <Route path="/payment" element={<Payment />} /> {/* <-- added Payment route */}
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/store/:slug" element={<BusinessShop />} />
        <Route path="/:slug" element={<BusinessShop />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
