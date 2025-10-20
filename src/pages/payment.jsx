import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { db } from "../firebase";
import { doc, setDoc, collection, getDoc } from "firebase/firestore";
import { PaystackButton } from "react-paystack";

export default function Payment() {
  const auth = getAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState(null);
  const [cart, setCart] = useState(location.state?.cart || []);
  const [subtotal, setSubtotal] = useState(location.state?.total || 0);
  const [deliveryFee] = useState(0); // fixed delivery fee
  const [grandTotal, setGrandTotal] = useState(subtotal + deliveryFee);

  const [deliveryInfo, setDeliveryInfo] = useState({
    name: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    instructions: "",
  });

  const paystackPublicKey = "pk_live_2d4df84806ccc14243f39a9df0bb0a38373ffcc8";

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (!u) return navigate("/auth");
      setUser(u);

      if (cart.length === 0) {
        const cartRef = doc(db, "carts", u.uid);
        const cartSnap = await getDoc(cartRef);
        if (cartSnap.exists()) {
          const items = cartSnap.data().items || [];
          setCart(items);
          const sum = items.reduce(
            (acc, item) => acc + item.price * (item.quantity || 1),
            0
          );
          setSubtotal(sum);
          setGrandTotal(sum + deliveryFee);
        }
      }
    });
    return unsubscribe;
  }, [auth, cart.length, deliveryFee, navigate]);

  useEffect(() => {
    setGrandTotal(subtotal + deliveryFee);
  }, [subtotal, deliveryFee]);

  const isDeliveryInfoValid = () => {
    const requiredFields = ["name", "phone", "address", "city", "state"];
    return requiredFields.every((field) => deliveryInfo[field]?.trim());
  };

  const config = {
    reference: new Date().getTime().toString(),
    email: user?.email,
    amount: grandTotal * 100,
    publicKey: paystackPublicKey,
  };

  const handlePaymentSuccess = async (reference) => {
    if (!user || cart.length === 0) return;

    const orderRef = doc(collection(db, "orders"));
    await setDoc(orderRef, {
      userId: user.uid,
      items: cart,
      subtotal,
      deliveryFee,
      total: grandTotal,
      status: "Processing",
      date: new Date().toISOString(),
      paymentReference: reference.reference,
      deliveryInfo,
    });

    await setDoc(doc(db, "carts", user.uid), { items: [] });
    setCart([]);
    setSubtotal(0);
    setGrandTotal(0);

    alert("✅ Payment successful! Order created.");
    navigate("/orders");
  };

  const handlePaymentClose = () => {
    alert("Payment cancelled.");
  };

  const handleInputChange = (e) => {
    setDeliveryInfo({ ...deliveryInfo, [e.target.name]: e.target.value });
  };

  const handleDisabledClick = () => {
    // Only triggered if user tries to click disabled button
    alert("⚠️ Please complete all delivery information before proceeding.");
  };

  if (!user) return <p>Loading...</p>;

  return (
    <div style={{ padding: "30px", maxWidth: "600px", margin: "auto" }}>
      <h2>💳 Checkout</h2>

      {cart.length === 0 ? (
        <p>No items in cart.</p>
      ) : (
        <>
          <h3>🛒 Order Summary</h3>
          <ul style={{ listStyle: "none", padding: 0 }}>
            {cart.map((item, i) => (
              <li key={i} style={{ marginBottom: "8px" }}>
                {item.name} – ₦{item.price} x {item.quantity || 1} = ₦
                {item.price * (item.quantity || 1)}
              </li>
            ))}
          </ul>
          <p>Subtotal: ₦{subtotal}</p>
          <p>Delivery Fee: ₦{deliveryFee}</p>
          <p>
            <strong>Grand Total: ₦{grandTotal}</strong>
          </p>

          <h3>📍 Delivery Information</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <input
              type="text"
              name="name"
              placeholder="Full Name"
              value={deliveryInfo.name}
              onChange={handleInputChange}
            />
            <input
              type="text"
              name="phone"
              placeholder="Phone Number"
              value={deliveryInfo.phone}
              onChange={handleInputChange}
            />
            <input
              type="text"
              name="address"
              placeholder="Street Address"
              value={deliveryInfo.address}
              onChange={handleInputChange}
            />
            <input
              type="text"
              name="city"
              placeholder="City"
              value={deliveryInfo.city}
              onChange={handleInputChange}
            />
            <input
              type="text"
              name="state"
              placeholder="State"
              value={deliveryInfo.state}
              onChange={handleInputChange}
            />
            <textarea
              name="instructions"
              placeholder="Delivery Instructions (optional)"
              value={deliveryInfo.instructions}
              onChange={handleInputChange}
            />
          </div>

          {isDeliveryInfoValid() ? (
            <PaystackButton
              text="Pay Now 💳"
              className="paystack-button"
              {...config}
              onSuccess={handlePaymentSuccess}
              onClose={handlePaymentClose}
              style={{ marginTop: "20px" }}
            />
          ) : (
            <button
              onClick={handleDisabledClick}
              style={{ marginTop: "20px", cursor: "not-allowed" }}
            >
              Pay Now 💳
            </button>
          )}
        </>
      )}
    </div>
  );
}
