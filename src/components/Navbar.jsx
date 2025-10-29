import React, { useState, useEffect, useRef } from "react";

// Responsive helper
const isMobile = () => typeof window !== 'undefined' && window.innerWidth <= 600;
import { Link, useLocation, useNavigate } from "react-router-dom";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { db } from "../firebase";
import { getDoc, doc, onSnapshot, setDoc } from "firebase/firestore";

// Default logo path
const DEFAULT_LOGO = "/pharmastack-logo.png";
const LOGO_CONFIG_DOC = "pharmastack-config";
const LOGO_CONFIG_KEY = "navbarLogoUrl";

// Helper to check if user is admin
function isAdminRole(role) {
  return role === "admin";
}

const navStyle = {
  background: "linear-gradient(90deg, #e0e7ff 0%, #f4f6fb 100%)",
  borderBottom: "1px solid #e0e7ff",
  boxShadow: "0 2px 8px #c7d2fe22",
  position: "sticky",
  top: 0,
  zIndex: 1000,
  width: "100%",
};

const getNavContainerStyle = () => ({
  maxWidth: 1200,
  margin: "0 auto",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: isMobile() ? "0 8px" : "0 24px",
  height: isMobile() ? 54 : 70,
  flexWrap: isMobile() ? "wrap" : "nowrap",
});

const logoBoxStyle = {
  display: "flex",
  alignItems: "center",
  height: "100%",
  marginLeft: 0, // fixed
};

const getNavLinksGroupStyle = () => ({
  display: "flex",
  alignItems: "center",
  gap: isMobile() ? 8 : 24,
  flexGrow: 1,
  justifyContent: "center",
  flexWrap: isMobile() ? "wrap" : "nowrap",
  fontSize: isMobile() ? 13 : 16,
});

const navRightStyle = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  justifyContent: "flex-end",
  minWidth: 120,
};

const linkStyle = {
  color: "#2d3748",
  textDecoration: "none",
  fontWeight: 600,
  fontSize: isMobile() ? 13 : 16,
  padding: isMobile() ? "6px 8px" : "8px 14px",
  borderRadius: 8,
  transition: "background 0.2s, color 0.2s",
};

const linkActiveStyle = {
  color: "#014d4e",
  borderBottom: "2px solid #014d4e",
};

const brandStyle = {
  fontWeight: 900,
  fontSize: 22,
  color: "#6366f1",
  letterSpacing: 1.2,
  display: "flex",
  alignItems: "center",
  gap: 8,
  textDecoration: "none",
};

const brandLogoStyle = {
  height: 120,
  display: "block",
  objectFit: "contain",
  cursor: "pointer",
  borderRadius: 5,
  background: "transparent",
};

function NavLink({ to, children, ...props }) {
  const location = useLocation();
  const isActive = location.pathname === to;
  return (
    <Link
      to={to}
      style={{ ...linkStyle, ...(isActive ? linkActiveStyle : {}) }}
      {...props}
    >
      {children}
    </Link>
  );
}

export default function Navbar() {
  // Avatar menu state
  const [menuOpen, setMenuOpen] = useState(false);
  // Logo state (URL from Firestore or default)
  const [logoUrl, setLogoUrl] = useState(DEFAULT_LOGO);
  const [logoLoading, setLogoLoading] = useState(false);
  const fileInputRef = useRef();

  // User email and initial
  const userEmail = getAuth().currentUser?.email || "";
  const userInitial = userEmail[0]?.toUpperCase() || "?";

  // Fetch logo Base64 from Firestore config on mount
  useEffect(() => {
    const fetchLogo = async () => {
      try {
        const configDoc = await getDoc(doc(db, "config", LOGO_CONFIG_DOC));
        if (configDoc.exists() && configDoc.data()[LOGO_CONFIG_KEY]) {
          setLogoUrl(configDoc.data()[LOGO_CONFIG_KEY]);
        } else {
          setLogoUrl(DEFAULT_LOGO);
        }
      } catch (err) {
        setLogoUrl(DEFAULT_LOGO);
      }
    };
    fetchLogo();
  }, []);

  // Admin logo upload handler (Base64 to Firestore)
  const handleLogoChange = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setLogoLoading(true);
    try {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const base64 = ev.target.result;
        await setDoc(doc(db, "config", LOGO_CONFIG_DOC), { [LOGO_CONFIG_KEY]: base64 }, { merge: true });
        setLogoUrl(base64);
        setLogoLoading(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      alert("Logo upload failed. Please try again.");
      setLogoLoading(false);
    }
  };

  const navigate = useNavigate();
  const [cartCount, setCartCount] = useState(0);
  const [userRole, setUserRole] = useState(null);

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
    <nav style={navStyle}>
      <div style={getNavContainerStyle()}>
        {/* Logo Section */}
        <div style={logoBoxStyle}>
          {isAdminRole(userRole) ? (
            <>
              <input
                type="file"
                accept="image/*"
                ref={fileInputRef}
                style={{ display: "none" }}
                onChange={handleLogoChange}
                disabled={logoLoading}
              />
              <Link
                to="/"
                style={brandStyle}
                onClick={(e) => {
                  e.preventDefault();
                  if (!logoLoading) fileInputRef.current.click();
                }}
              >
                <img
                  src={logoUrl}
                  alt="Pharmastack Logo"
                  style={{
                    ...brandLogoStyle,
                    border: logoLoading ? "2px solid #fbbf24" : "2px dashed #b3e5fc",
                    opacity: logoLoading ? 0.5 : 1,
                  }}
                  title={logoLoading ? "Uploading..." : "Click to upload new logo"}
                />
              </Link>
            </>
          ) : (
            <Link to="/" style={brandStyle}>
              <img
                src={logoUrl}
                alt="Pharmastack Logo"
                style={brandLogoStyle}
              />
            </Link>
          )}
        </div>

        {/* Center Nav Links */}
  <div style={getNavLinksGroupStyle()}>
          {userRole !== "delivery-agent" && (
            <>
              {storeSlug ? (
                <>
                  <NavLink to={`/store/${storeSlug}`}>Shop</NavLink>
                  <div style={{ position: "relative", display: "inline-block" }}>
                    <NavLink to={`/store/${storeSlug}/cart`}>Cart</NavLink>
                    {cartCount > 0 && (
                      <span
                        style={{
                          position: "absolute",
                          top: "-8px",
                          right: "-16px",
                          background: "#e53935",
                          color: "#fff",
                          borderRadius: "50%",
                          padding: "2px 7px",
                          fontSize: "13px",
                          fontWeight: "bold",
                          boxShadow: "0 1px 4px rgba(0,0,0,0.10)",
                        }}
                      >
                        {cartCount}
                      </span>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <NavLink to="/shop">Shop</NavLink>
                  <div style={{ position: "relative", display: "inline-block" }}>
                    <NavLink to="/cart">Cart</NavLink>
                    {cartCount > 0 && (
                      <span
                        style={{
                          position: "absolute",
                          top: "-8px",
                          right: "-16px",
                          background: "#e53935",
                          color: "#fff",
                          borderRadius: "50%",
                          padding: "2px 7px",
                          fontSize: "13px",
                          fontWeight: "bold",
                          boxShadow: "0 1px 4px rgba(0,0,0,0.10)",
                        }}
                      >
                        {cartCount}
                      </span>
                    )}
                  </div>
                </>
              )}
              <NavLink to="/orders">Orders</NavLink>
              {userRole !== "medicine-manager" && <NavLink to="/medinterface">Medinterface</NavLink>}

              {!storeSlug && userRole && userRole !== "customer" && (
                <>
                  {(userRole === "medicine-manager" ||
                    userRole === "admin" ||
                    userRole === "delivery-agent") && (
                    <NavLink to="/add-medicine">Add Medicine</NavLink>
                  )}
                  {(userRole === "admin") && (
                    <NavLink to="/admin">Admin</NavLink>
                  )}
                  {(userRole === "delivery-agent" || userRole === "admin") && (
                    <NavLink to="/agents">All Agents</NavLink>
                  )}
                </>
              )}
            </>
          )}
        </div>

        {/* Right Auth/User */}


<div style={navRightStyle}>
  {userRole ? (
    <div style={{ position: "relative" }}>

      {/* Avatar and Sign Out Button */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div
          onClick={() => setMenuOpen(!menuOpen)}
          style={{
            width: 38,
            height: 38,
            borderRadius: "50%",
            background: "#00796b",
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 700,
            cursor: "pointer",
            userSelect: "none",
            boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
          }}
          title={userEmail}
        >
          {userInitial}
        </div>
        <button
          onClick={async () => {
            await getAuth().signOut();
            window.location.href = "/pharmastack/#/auth";
          }}
          style={{
            width: 38,
            height: 38,
            borderRadius: "50%",
            background: "#e53935",
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "none",
            marginLeft: 0,
            cursor: "pointer",
            fontSize: 18,
            boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
            transition: "background 0.2s",
          }}
          title="Sign Out"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M13.5 13.5L17 10M17 10L13.5 6.5M17 10H7" stroke="white" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M10 17C6.13401 17 3 13.866 3 10C3 6.13401 6.13401 3 10 3" stroke="white" strokeWidth="1.7" strokeLinecap="round"/>
          </svg>
        </button>
      </div>

      {/* Dropdown */}
      {menuOpen && (
        <div
          style={{
            position: "absolute",
            top: "46px",
            right: 0,
            background: "#fff",
            borderRadius: 8,
            boxShadow: "0 4px 10px rgba(0,0,0,0.15)",
            minWidth: 180,
            zIndex: 2000,
            padding: "8px 0",
          }}
        >
          <div
            style={{
              padding: "8px 16px",
              fontSize: 14,
              fontWeight: 500,
              color: "#2d3748",
              borderBottom: "1px solid #edf2f7",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              maxWidth: 180,
            }}
          >
            {userEmail}
          </div>
          <button
            onClick={async () => {
              await getAuth().signOut();
              window.location.href = "/pharmastack/#/auth";
            }}
            style={{
              display: "block",
              width: "100%",
              textAlign: "left",
              padding: "10px 16px",
              border: "none",
              background: "transparent",
              color: "#e53e3e",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Sign Out
          </button>
        </div>
      )}
    </div>
  ) : (
    <>
      <NavLink to="/auth">Login</NavLink>
      <NavLink to="/auth">Signup</NavLink>
    </>
  )}
</div>

      </div>
    </nav>
  );
}
