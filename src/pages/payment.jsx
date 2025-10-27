import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { db } from "../firebase";
import { doc, setDoc, collection, getDoc } from "firebase/firestore";
import { PaystackButton } from "react-paystack";
import { validateCoupon } from "../utils/coupon";

export default function Payment() {
  const [coupon, setCoupon] = useState("");
  const [couponData, setCouponData] = useState(null);
  const [couponError, setCouponError] = useState("");
  const auth = getAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState(null);
  const [cart, setCart] = useState(location.state?.cart || []);
  const [subtotal, setSubtotal] = useState(location.state?.total || 0);
  const [deliveryType, setDeliveryType] = useState("standard");
  const [deliveryFee, setDeliveryFee] = useState(500); // default standard
  const [pomFee, setPomFee] = useState(1000);
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
    // Check for POM items
  let pomFee = cart.some(item => item.isPOM) ? 500 : 0;
  let delivery = deliveryFee;
    let sub = subtotal;
    let discount = 0;
    if (couponData) {
      if (couponData.removePOM) pomFee = 0;
      if (couponData.removeDelivery) delivery = 0;
      if (couponData.percent > 0) discount = Math.round((sub + pomFee + delivery) * (couponData.percent / 100));
    }
    setPomFee(pomFee);
    setGrandTotal(sub + pomFee + delivery - discount);
  }, [subtotal, deliveryFee, cart, couponData]);

  // Update delivery fee when delivery type changes
  useEffect(() => {
    if (deliveryType === "standard") {
      setDeliveryFee(500);
    } else {
      setDeliveryFee(3000);
    }
  }, [deliveryType]);
  const handleApplyCoupon = async () => {
    setCouponError("");
    const data = await validateCoupon(coupon.trim().toUpperCase());
    if (!data) {
      setCouponData(null);
      setCouponError("Invalid coupon code");
    } else {
      setCouponData(data);
      setCouponError("");
    }
  };

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
      pomFee,
      total: grandTotal,
      status: "Processing",
      date: new Date().toISOString(),
      paymentReference: reference?.reference || "COUPON_FREE",
      deliveryInfo,
      coupon: couponData || null,
      deliveryType, // <-- Save delivery type
    });

    await setDoc(doc(db, "carts", user.uid), { items: [] });
    setCart([]);
    setSubtotal(0);
    setGrandTotal(0);

    alert("✅ Payment successful! Order created.");
    if (cart.some(item => item.isPOM)) {
      navigate("/medinterface");
    } else {
      navigate("/orders");
    }
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
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontWeight: 500 }}>Delivery Type:</label>
            <select
              value={deliveryType}
              onChange={e => setDeliveryType(e.target.value)}
              style={{ marginLeft: 10, padding: '6px', borderRadius: '5px' }}
            >
              <option value="standard">Standard Delivery (1-2 days) - ₦500</option>
              <option value="express">Express Delivery (30mins-3hrs) - ₦3000</option>
            </select>
          </div>
          <p>Delivery Fee: ₦{couponData?.removeDelivery ? 0 : deliveryFee}</p>
          <p style={{ color: pomFee > 0 ? "#e53935" : undefined, fontWeight: pomFee > 0 ? 500 : undefined }}>
            POM Fee: ₦{couponData?.removePOM ? 0 : pomFee}
          </p>
          {couponData?.percent > 0 && (
            <p style={{ color: "#007bff" }}>Discount: -₦{Math.round((subtotal + pomFee + (couponData?.removeDelivery ? 0 : deliveryFee)) * (couponData.percent / 100))}</p>
          )}
          {/* Coupon Input - moved here */}
          <div style={{ marginBottom: 18 }}>
            <input
              type="text"
              placeholder="Coupon code"
              value={coupon}
              onChange={e => setCoupon(e.target.value)}
              style={{ marginRight: 10 }}
            />
            <button type="button" onClick={handleApplyCoupon}>Apply Coupon</button>
            {couponError && <span style={{ color: "#e53935", marginLeft: 10 }}>{couponError}</span>}
            {couponData && (
              <span style={{ color: "#007bff", marginLeft: 10 }}>
                Applied: {couponData.code} ({couponData.percent}% off{couponData.removePOM ? ", no POM fee" : ""}{couponData.removeDelivery ? ", no delivery fee" : ""})
              </span>
            )}
          </div>
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
            grandTotal > 0 ? (
              <PaystackButton
                text="Pay Now 💳"
                className="paystack-button"
                {...config}
                callback={handlePaymentSuccess}
                close={handlePaymentClose}
                style={{ marginTop: "20px" }}
              />
            ) : (
              <button
                onClick={() => handlePaymentSuccess({ reference: "COUPON_FREE" })}
                style={{ marginTop: "20px", background: "#007bff", color: "#fff", border: "none", borderRadius: "5px", padding: "10px 20px", fontWeight: "bold" }}
              >
                Complete Order (Free)
              </button>
            )
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
