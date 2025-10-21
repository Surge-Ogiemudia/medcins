import { useEffect, useState } from "react";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { db } from "../firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";

export default function Cart() {
  const [showRegistration, setShowRegistration] = useState(false);
  const [registrationData, setRegistrationData] = useState({});
  const [distributorIds, setDistributorIds] = useState([]);
  const [businessInfo, setBusinessInfo] = useState(null);

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
    alert("Registration request(s) sent to distributor(s). Await approval before completing your order.");
    // Optionally, redirect or update UI
    setShowRegistration(false);
  };
  const auth = getAuth();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [cart, setCart] = useState([]);
  const [total, setTotal] = useState(0);

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
    if (!user) return alert("Please login first");

    const newCart = [...cart];
    const index = newCart.findIndex((i) => i.name === item.name);
    if (index >= 0) newCart[index].quantity += 1;
    else newCart.push({ ...item, quantity: 1 });

    setCart(newCart);
    saveCart(user.uid, newCart);
  };

  // Remove item from cart
  const removeFromCart = (itemName) => {
    if (!user) return alert("Please login first");

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
    if (!user) return alert("Please login to proceed to payment");
    if (cart.length === 0) return alert("Cart is empty");
    navigate("/payment", { state: { cart, total } });
  };

  return (
    <div style={{ padding: "30px" }}>
      <h2>🛒 Your Cart</h2>
      {user ? <p>Logged in as: {user.email}</p> : <p>Please log in.</p>}

      {cart.length === 0 ? (
        <p>No items in cart.</p>
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
          <button type="submit" style={{ background: "#7c3aed", color: "#fff", padding: "10px 24px", borderRadius: 6, fontWeight: "bold" }}>Submit Registration</button>
        </form>
      ) : (
        <>
          <ul style={{ listStyle: "none", padding: 0 }}>
            {cart.map((item, i) => (
              <li
                key={i}
                style={{ margin: "8px 0", display: "flex", alignItems: "center", gap: "10px" }}
              >
                {item.image && (
                  <img
                    src={item.image}
                    alt={item.name}
                    style={{ width: "50px", height: "50px", objectFit: "cover", borderRadius: "5px" }}
                  />
                )}
                <div>
                  <strong>{item.name}</strong> – ₦{item.price} x {item.quantity}
                </div>
                <div>
                  <button onClick={() => addToCart(item)} style={{ marginLeft: "10px" }}>
                    +
                  </button>
                  <button onClick={() => removeFromCart(item.name)} style={{ marginLeft: "5px" }}>
                    -
                  </button>
                </div>
              </li>
            ))}
          </ul>
          {/* POM info note */}
          {cart.some(item => item.isPOM) && (
            <div style={{ background: "#fff3e0", color: "#b85c00", borderRadius: "6px", padding: "10px 16px", margin: "18px 0 0 0", fontSize: "15px", boxShadow: "0 1px 4px #f5e0c3" }}>
              <span style={{ fontWeight: 500 }}>Note:</span> After payment, you will be redirected to a medical professional to verify your prescription.
            </div>
          )}
        </>
      )}

      <h3>Total: ₦{total}</h3>
      {!showRegistration && (
        <button onClick={goToPayment} style={{ marginTop: "20px" }}>
          Checkout
        </button>
      )}
    </div>
  );
}
