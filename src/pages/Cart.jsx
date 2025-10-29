import { useEffect, useState } from "react";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { db } from "../firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

export default function Cart() {
  const [user, setUser] = useState(null);
  const [cart, setCart] = useState([]);
  const [total, setTotal] = useState(0);
  const [showRegistration, setShowRegistration] = useState(false);
  const [registrationData, setRegistrationData] = useState({});
  const [distributorIds, setDistributorIds] = useState([]);
  const [businessInfo, setBusinessInfo] = useState(null);
  const auth = getAuth();
  const navigate = useNavigate();

  // Fetch business info for prefill
  useEffect(() => {
    if (!user) return;
    getDoc(doc(db, "users", user.uid)).then(snap => {
      if (snap.exists()) setBusinessInfo(snap.data());
    });
  }, [user]);

  // Check for registeredOnly products in cart
  useEffect(() => {
    const ids = Array.from(new Set(cart.filter(item => item.registeredOnly && item.ownerId).map(item => item.ownerId)));
    setDistributorIds(ids);
    setShowRegistration(ids.length > 0);
  }, [cart]);

  // Handle registration form submit
  const handleRegistrationSubmit = async (e) => {
    e.preventDefault();
    // Save registration requests for each distributor
    for (const distributorId of distributorIds) {
      await setDoc(doc(db, "businessRegistrations", `${distributorId}_${user.uid}`), {
        distributorId,
        businessId: user.uid,
        businessInfo,
        cart: cart.filter(item => item.ownerId === distributorId),
        status: "pending",
        date: new Date().toISOString(),
      });
    }
    toast.info("Registration request(s) sent to distributor(s). Await approval before completing your order.");
    // Optionally, redirect or update UI
    setShowRegistration(false);
  };

  // Watch auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) loadCart(u.uid);
    });
    return unsubscribe;
  }, [auth]);

  // Load cart from Firestore
  const loadCart = async (uid) => {
    try {
      const docRef = doc(db, "carts", uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) setCart(docSnap.data().items || []);
      else setCart([]);
    } catch (err) {
      console.error("Error loading cart:", err);
    }
  };

  // Save cart to Firestore
  const saveCart = async (uid, updatedCart) => {
    try {
      await setDoc(doc(db, "carts", uid), { items: updatedCart });
    } catch (err) {
      console.error("Error saving cart:", err);
    }
  };

  // Update total whenever cart changes
  useEffect(() => {
    const sum = cart.reduce((acc, item) => acc + item.price * (item.quantity || 1), 0);
    setTotal(sum);
  }, [cart]);

  // Add item to cart
  const addToCart = (item) => {
  if (!user) return toast.error("Please login first");

    const newCart = [...cart];
    const index = newCart.findIndex((i) => i.name === item.name);
    if (index >= 0) newCart[index].quantity += 1;
    else newCart.push({ ...item, quantity: 1 });

    setCart(newCart);
    saveCart(user.uid, newCart);
  };

  // Remove item from cart
  const removeFromCart = (itemName) => {
  if (!user) return toast.error("Please login first");

    const newCart = [...cart];
    const index = newCart.findIndex((i) => i.name === itemName);
    if (index >= 0) {
      if (newCart[index].quantity > 1) newCart[index].quantity -= 1;
      else newCart.splice(index, 1);
    }

    setCart(newCart);
    saveCart(user.uid, newCart);
  };

  // Navigate to Payment page
  const goToPayment = () => {
  if (!user) return toast.error("Please login to proceed to payment");
  if (cart.length === 0) return toast.info("Cart is empty");
    navigate("/payment", { state: { cart, total } });
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #f4f6fb 0%, #e0e7ff 100%)',
      padding: '30px',
      fontFamily: 'Inter, Arial, sans-serif',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
    }}>
      <h2 style={{ fontWeight: 800, color: '#2d3748', fontSize: 32, marginBottom: 8, letterSpacing: 1 }}>🛒 Your Cart</h2>
      {user ? (
        <div style={{ color: '#6366f1', fontSize: 16, marginBottom: 18, fontWeight: 500 }}>Logged in as: {user.email}</div>
      ) : (
        <div style={{ color: '#e53e3e', fontSize: 18, marginBottom: 18, fontWeight: 600 }}>Please log in to view your cart.</div>
      )}

      <div style={{ width: '100%', maxWidth: 900, display: 'flex', gap: 32, alignItems: 'flex-start', marginTop: 10 }}>
        {/* Cart Items Section */}
        <div style={{ flex: 2 }}>
          {cart.length === 0 ? (
            <div style={{ color: '#64748b', fontSize: 20, marginTop: 40, textAlign: 'center', fontWeight: 500, background: '#fff', borderRadius: 12, padding: 32, boxShadow: '0 2px 12px #c7d2fe22' }}>
              Your cart is empty. Start shopping to add medicines!
            </div>
          ) : showRegistration ? (
            <form onSubmit={handleRegistrationSubmit} style={{ background: "#f3f0ff", padding: 24, borderRadius: 10, margin: "20px 0" }}>
              <h3 style={{ color: "#7c3aed" }}>Distributor Registration Required</h3>
              <p>Some items in your cart require registration with the distributor before purchase. Please confirm your business details below for each distributor.</p>
              {distributorIds.map((distId, idx) => (
                <div key={distId} style={{ marginBottom: 24, padding: 16, background: "#fff", borderRadius: 8, boxShadow: "0 1px 4px #e0e0e0" }}>
                  <h4 style={{ color: "#7c3aed" }}>Distributor {idx + 1}</h4>
                  <label>Business Name:<br/>
                    <input type="text" value={businessInfo?.businessName || ""} readOnly style={{ width: "100%", marginBottom: 8 }} />
                  </label><br/>
                  <label>Email:<br/>
                    <input type="email" value={businessInfo?.email || user?.email || ""} readOnly style={{ width: "100%", marginBottom: 8 }} />
                  </label><br/>
                  <label>Phone:<br/>
                    <input type="text" value={businessInfo?.phone || ""} readOnly style={{ width: "100%", marginBottom: 8 }} />
                  </label><br/>
                  <label>Address:<br/>
                    <input type="text" value={businessInfo?.address || ""} readOnly style={{ width: "100%", marginBottom: 8 }} />
                  </label>
                  <p style={{ fontSize: 14, color: "#555" }}>Products from this distributor: {cart.filter(item => item.ownerId === distId).map(item => item.name).join(", ")}</p>
                </div>
              ))}
              <button type="submit" style={{ background: "#6366f1", color: "#fff", padding: "12px 32px", borderRadius: 10, fontWeight: 700, fontSize: 16, boxShadow: '0 2px 8px #6366f122', border: 'none', marginTop: 10, cursor: 'pointer', transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = '#4f46e5'} onMouseLeave={e => e.currentTarget.style.background = '#6366f1'}>Submit Registration</button>
            </form>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {cart.map((item, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 18, background: '#fff', borderRadius: 12, boxShadow: '0 2px 12px #c7d2fe22', padding: '18px 18px 14px 18px', minHeight: 80, transition: 'box-shadow 0.2s, transform 0.2s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 8px 32px #6366f133'; e.currentTarget.style.transform = 'translateY(-2px) scale(1.01)'; }}
                  onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 2px 12px #c7d2fe22'; e.currentTarget.style.transform = 'none'; }}
                >
                  {item.image ? (
                    <img
                      src={item.image}
                      alt={item.name}
                      style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 8, background: '#f4f6fb' }}
                      onError={e => { e.target.onerror = null; e.target.src = 'https://via.placeholder.com/60x60?text=No+Image'; }}
                    />
                  ) : (
                    <div style={{ width: 60, height: 60, borderRadius: 8, background: '#f4f6fb', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#b3b3e7', fontSize: 16, fontWeight: 700 }}>No Image</div>
                  )}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 18, color: '#2d3748' }}>{item.name}</div>
                    <div style={{ color: '#059669', fontWeight: 600, fontSize: 16 }}>₦{item.price} <span style={{ color: '#64748b', fontWeight: 400, fontSize: 15 }}>x {item.quantity}</span></div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => addToCart(item)} style={{ background: '#6366f1', color: '#fff', border: 'none', borderRadius: 8, width: 36, height: 36, fontWeight: 700, fontSize: 20, cursor: 'pointer', boxShadow: '0 2px 8px #6366f122', transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = '#4f46e5'} onMouseLeave={e => e.currentTarget.style.background = '#6366f1'}>+</button>
                    <button onClick={() => removeFromCart(item.name)} style={{ background: '#e53e3e', color: '#fff', border: 'none', borderRadius: 8, width: 36, height: 36, fontWeight: 700, fontSize: 20, cursor: 'pointer', boxShadow: '0 2px 8px #e53e3e22', transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = '#b91c1c'} onMouseLeave={e => e.currentTarget.style.background = '#e53e3e'}>-</button>
                  </div>
                </div>
              ))}
              {/* POM info note */}
              {cart.some(item => item.isPOM) && (
                <div style={{ background: "#fff3e0", color: "#b85c00", borderRadius: "8px", padding: "12px 18px", margin: "10px 0 0 0", fontSize: "15px", boxShadow: "0 1px 4px #f5e0c3", fontWeight: 500 }}>
                  <span style={{ fontWeight: 600 }}>Note:</span> After payment, you will be redirected to a medical professional to verify your prescription.
                </div>
              )}
            </div>
          )}
        </div>
        {/* Sticky Summary/Checkout Section */}
        <div style={{ flex: 1, position: 'sticky', top: 30, alignSelf: 'flex-start' }}>
          <div style={{ background: '#fff', borderRadius: 14, boxShadow: '0 2px 12px #c7d2fe22', padding: '28px 24px', minWidth: 260, marginTop: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 20, color: '#2d3748', marginBottom: 10 }}>Order Summary</div>
            <div style={{ color: '#64748b', fontSize: 16, marginBottom: 8 }}>Items: <b>{cart.reduce((acc, item) => acc + (item.quantity || 1), 0)}</b></div>
            <div style={{ color: '#059669', fontWeight: 700, fontSize: 22, marginBottom: 18 }}>Total: ₦{total}</div>
            {!showRegistration && (
              <button onClick={goToPayment} style={{ width: '100%', background: '#6366f1', color: '#fff', border: 'none', borderRadius: 10, padding: '14px 0', fontWeight: 700, fontSize: 18, cursor: 'pointer', boxShadow: '0 2px 8px #6366f122', transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = '#4f46e5'} onMouseLeave={e => e.currentTarget.style.background = '#6366f1'}>Checkout</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
