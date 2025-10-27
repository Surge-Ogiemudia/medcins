import React, { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { db } from "../firebase";
import { getDoc, doc } from "firebase/firestore";
import { onSnapshot } from "firebase/firestore";

export default function Navbar() {
  const navigate = useNavigate();
  const [cartCount, setCartCount] = useState(0);
  useEffect(() => {
    const auth = getAuth();
    let unsubscribeCart = null;
    const unsubscribeAuth = onAuthStateChanged(auth, (u) => {
      if (unsubscribeCart) unsubscribeCart();
      if (u) {
        const cartRef = doc(db, "carts", u.uid);
        unsubscribeCart = onSnapshot(cartRef, (cartSnap) => {
          if (cartSnap.exists()) {
            const items = cartSnap.data().items || [];
            setCartCount(items.length);
          } else {
            setCartCount(0);
          }
        });
      } else {
        setCartCount(0);
      }
    });
    return () => {
      unsubscribeAuth();
      if (unsubscribeCart) unsubscribeCart();
    };
  }, []);
  const location = useLocation();
  const path = location.pathname;
  const storeMatch = path.match(/^\/store\/([^\/]+)/);
  const storeSlug = storeMatch ? storeMatch[1] : null;
  const [userRole, setUserRole] = useState(null);

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (u) {
        const snap = await getDoc(doc(db, "users", u.uid));
        setUserRole(snap.exists() ? snap.data().role : null);
      } else {
        setUserRole(null);
      }
    });
    return () => unsubscribe();
  }, []);

  return (
    <nav
      style={{
        display: "flex",
        gap: "20px",
        padding: "20px",
        background: "#f8f8f8",
        borderBottom: "1px solid #ddd",
      }}
    >
      {/* Minimal navbar for delivery agents */}
      {userRole === "delivery-agent" ? (
        <>
          <Link to="/auth">Auth</Link>
          <button
            onClick={async () => {
              await getAuth().signOut();
              // Always force correct hash-based URL for GitHub Pages
              window.location.href = "/medcins/#/auth";
            }}
            style={{ marginLeft: 12 }}
          >
            Logout
          </button>
        </>
      ) : (
        <>
          <Link to="/">Home</Link>
          {storeSlug ? (
            <>
              <Link to={`/store/${storeSlug}`}>Shop</Link>
              <div style={{ position: 'relative', display: 'inline-block' }}>
                <Link to={`/store/${storeSlug}/cart`}>Cart</Link>
                {cartCount > 0 && (
                  <span style={{
                    position: 'absolute',
                    top: '-8px',
                    right: '-16px',
                    background: '#e53935',
                    color: '#fff',
                    borderRadius: '50%',
                    padding: '2px 7px',
                    fontSize: '13px',
                    fontWeight: 'bold',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.10)',
                    zIndex: 10
                  }}>{cartCount}</span>
                )}
              </div>
            </>
          ) : (
            <>
              <Link to="/shop">Shop</Link>
              <div style={{ position: 'relative', display: 'inline-block' }}>
                <Link to="/cart">Cart</Link>
                {cartCount > 0 && (
                  <span style={{
                    position: 'absolute',
                    top: '-8px',
                    right: '-16px',
                    background: '#e53935',
                    color: '#fff',
                    borderRadius: '50%',
                    padding: '2px 7px',
                    fontSize: '13px',
                    fontWeight: 'bold',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.10)',
                    zIndex: 10
                  }}>{cartCount}</span>
                )}
              </div>
            </>
          )}
          <Link to="/auth">Auth</Link>
          <Link to="/orders">Orders</Link>
          {/* Show business/admin/delivery agent links if not inside a store and not customer */}
          {!storeSlug && userRole !== "customer" && (
            <>
              <Link to="/add-medicine">Add Medicine</Link>
              <Link to="/admin">Admin</Link>
              {(userRole === "delivery-agent" || userRole === "admin") && (
                <>
                  <Link to="/agents">All Agents</Link>
                </>
              )}
            </>
          )}
          <Link to="/medinterface">Medinterface</Link>
        </>
      )}
    </nav>
  );
}
