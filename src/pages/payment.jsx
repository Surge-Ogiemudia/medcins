import { useEffect, useState } from "react";
import { Box, Card, CardContent, Typography, Grid, FormControl, Select, MenuItem, TextField, Button, Divider, Alert } from "@mui/material";
import { useNavigate, useLocation } from "react-router-dom";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { db } from "../firebase";
import { doc, setDoc, collection, getDoc } from "firebase/firestore";
import { PaystackButton } from "react-paystack";
import { validateCoupon } from "../utils/coupon";
import { toast } from "react-toastify";

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
  // If cart is only a consultation, delivery fee is zero
  const isConsultOnly = cart.length === 1 && cart[0]?.isConsultation;
  const [deliveryType, setDeliveryType] = useState("standard");
  const [deliveryFee, setDeliveryFee] = useState(isConsultOnly ? 0 : 500);
  const [pomFee, setPomFee] = useState(1000);
  const [grandTotal, setGrandTotal] = useState(subtotal + (isConsultOnly ? 0 : deliveryFee));

  const [deliveryInfo, setDeliveryInfo] = useState({
    name: "",
    phone: "",
    address: "",
    age: "",
    complaint: "",
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
  let pomFee = cart.some(item => item.isPOM) ? 500 : 0; // leave as is, not related to consultation
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
    if (isConsultOnly) {
      setDeliveryFee(0);
    } else {
      if (deliveryType === "standard") {
  setDeliveryFee(500);
      } else {
        setDeliveryFee(3000);
      }
    }
  }, [deliveryType, isConsultOnly]);
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
    if (isConsultOnly) {
      // Only require name, phone, address, age, complaint
      const requiredFields = ["name", "phone", "address", "age", "complaint"];
      return requiredFields.every((field) => deliveryInfo[field]?.trim());
    } else {
      const requiredFields = ["name", "phone", "address", "city", "state"];
      return requiredFields.every((field) => deliveryInfo[field]?.trim());
    }
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

    toast.success("✅ Payment successful! Order created.");
    // If this is a consultation payment, redirect to WhatsApp
    const consultItem = cart.find(item => item.isConsultation && item.whatsapp);
    if (consultItem) {
      window.location.href = `https://wa.me/${consultItem.whatsapp}`;
      return;
    }
    // If there are POM items, redirect to the specific pharmacist attached to the medicine-manager/pharmacy
    const pomItem = cart.find(item => item.isPOM && item.pharmacist && item.ownerId);
    if (pomItem && pomItem.pharmacist && pomItem.ownerId) {
      // Redirect to chat with the pharmacist for this business
      navigate(`/chat/${pomItem.ownerId}`, { state: { pharmacist: pomItem.pharmacist, businessName: pomItem.businessName } });
      return;
    }
    if (cart.some(item => item.isPOM)) {
      // Fallback: if POM but no pharmacist info, go to medinterface
      navigate("/medinterface");
    } else {
      navigate("/orders");
    }
  };

  const handlePaymentClose = () => {
  toast.info("Payment cancelled.");
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
    <Box sx={{ p: 3, maxWidth: 600, mx: "auto" }}>
      <Card>
        <CardContent>
          <Typography variant="h5" fontWeight={700} gutterBottom>
            💳 Checkout
          </Typography>
          {cart.length === 0 ? (
            <Typography>No items in cart.</Typography>
          ) : (
            <>
              <Typography variant="h6" fontWeight={600} gutterBottom>
                🛒 Order Summary
              </Typography>
              <Box sx={{ mb: 2 }}>
                {cart.map((item, i) => (
                  <Box key={i} sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
                    <Typography>
                      {item.name} <span style={{ color: "#888", fontSize: 13 }}>x{item.quantity || 1}</span>
                    </Typography>
                    <Typography fontWeight={500}>₦{item.price * (item.quantity || 1)}</Typography>
                  </Box>
                ))}
              </Box>
              <Grid container spacing={1} sx={{ mb: 1 }}>
                <Grid item xs={7}>
                  <Typography>Subtotal:</Typography>
                </Grid>
                <Grid item xs={5}>
                  <Typography fontWeight={500}>₦{subtotal}</Typography>
                </Grid>
                {!isConsultOnly && (
                  <>
                    <Grid item xs={7}>
                      <Typography>Delivery Type:</Typography>
                    </Grid>
                    <Grid item xs={5}>
                      <FormControl fullWidth size="small">
                        <Select
                          value={deliveryType}
                          onChange={e => setDeliveryType(e.target.value)}
                          sx={{ bgcolor: "#fff", borderRadius: 2 }}
                        >
                          <MenuItem value="standard">Standard (1-2 days) - ₦500</MenuItem>
                          <MenuItem value="express">Express (30mins-3hrs) - ₦3000</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={7}>
                      <Typography>Delivery Fee:</Typography>
                    </Grid>
                    <Grid item xs={5}>
                      <Typography fontWeight={500}>₦{couponData?.removeDelivery ? 0 : deliveryFee}</Typography>
                    </Grid>
                  </>
                )}
                <Grid item xs={7}>
                  <Typography color={pomFee > 0 ? "error" : "inherit"}>POM Fee:</Typography>
                </Grid>
                <Grid item xs={5}>
                  <Typography fontWeight={500} color={pomFee > 0 ? "error" : "inherit"}>
                    ₦{couponData?.removePOM ? 0 : pomFee}
                  </Typography>
                </Grid>
                {couponData?.percent > 0 && (
                  <>
                    <Grid item xs={7}>
                      <Typography color="primary">Discount:</Typography>
                    </Grid>
                    <Grid item xs={5}>
                      <Typography color="primary">
                        -₦{Math.round((subtotal + pomFee + (couponData?.removeDelivery ? 0 : deliveryFee)) * (couponData.percent / 100))}
                      </Typography>
                    </Grid>
                  </>
                )}
                <Grid item xs={7}>
                  <Typography fontWeight={700}>Grand Total:</Typography>
                </Grid>
                <Grid item xs={5}>
                  <Typography fontWeight={700}>₦{grandTotal}</Typography>
                </Grid>
              </Grid>
              <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
                <TextField
                  size="small"
                  label="Coupon code"
                  value={coupon}
                  onChange={e => setCoupon(e.target.value)}
                  sx={{ mr: 1, flex: 1 }}
                />
                <Button variant="outlined" onClick={handleApplyCoupon}>
                  Apply
                </Button>
              </Box>
              {couponError && <Alert severity="error" sx={{ mb: 1 }}>{couponError}</Alert>}
              {couponData && (
                <Alert severity="success" sx={{ mb: 1 }}>
                  Applied: {couponData.code} ({couponData.percent}% off
                  {couponData.removePOM ? ", no POM fee" : ""}
                  {couponData.removeDelivery ? ", no delivery fee" : ""}
                  )
                </Alert>
              )}
              <Divider sx={{ my: 3 }} />
              {isConsultOnly ? (
                <>
                  <Typography variant="h6" fontWeight={600} gutterBottom>
                    🩺 Consultation Information
                  </Typography>
                  <Grid container spacing={2} sx={{ mb: 2 }}>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Full Name"
                        name="name"
                        value={deliveryInfo.name}
                        onChange={handleInputChange}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Phone Number"
                        name="phone"
                        value={deliveryInfo.phone}
                        onChange={handleInputChange}
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Address"
                        name="address"
                        value={deliveryInfo.address}
                        onChange={handleInputChange}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Age"
                        name="age"
                        value={deliveryInfo.age}
                        onChange={handleInputChange}
                        type="number"
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Major Complaint"
                        name="complaint"
                        value={deliveryInfo.complaint}
                        onChange={handleInputChange}
                        multiline
                        minRows={2}
                      />
                    </Grid>
                  </Grid>
                </>
              ) : (
                <>
                  <Typography variant="h6" fontWeight={600} gutterBottom>
                    �📍 Delivery Information
                  </Typography>
                  <Grid container spacing={2} sx={{ mb: 2 }}>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Full Name"
                        name="name"
                        value={deliveryInfo.name}
                        onChange={handleInputChange}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Phone Number"
                        name="phone"
                        value={deliveryInfo.phone}
                        onChange={handleInputChange}
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Street Address"
                        name="address"
                        value={deliveryInfo.address}
                        onChange={handleInputChange}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        size="small"
                        label="City"
                        name="city"
                        value={deliveryInfo.city}
                        onChange={handleInputChange}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        size="small"
                        label="State"
                        name="state"
                        value={deliveryInfo.state}
                        onChange={handleInputChange}
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Delivery Instructions (optional)"
                        name="instructions"
                        value={deliveryInfo.instructions}
                        onChange={handleInputChange}
                        multiline
                        minRows={2}
                      />
                    </Grid>
                  </Grid>
                </>
              )}
              <Box sx={{ mt: 2, textAlign: "center" }}>
                {isDeliveryInfoValid() ? (
                  grandTotal > 0 ? (
                    <PaystackButton
                      text="Pay Now 💳"
                      className="paystack-button"
                      {...config}
                      callback={handlePaymentSuccess}
                      close={handlePaymentClose}
                      style={{
                        marginTop: "10px",
                        minWidth: 180,
                        fontWeight: 600,
                        fontSize: 18,
                        borderRadius: 8,
                        background: "#007bff",
                        color: "#fff",
                      }}
                    />
                  ) : (
                    <Button
                      variant="contained"
                      color="primary"
                      sx={{ mt: 1, minWidth: 180, fontWeight: 600, fontSize: 18, borderRadius: 8 }}
                      onClick={() => handlePaymentSuccess({ reference: "COUPON_FREE" })}
                    >
                      Complete Order (Free)
                    </Button>
                  )
                ) : (
                  <Button
                    variant="contained"
                    color="primary"
                    sx={{
                      mt: 1,
                      minWidth: 180,
                      fontWeight: 600,
                      fontSize: 18,
                      borderRadius: 8,
                      opacity: 0.6,
                    }}
                    onClick={handleDisabledClick}
                    disabled
                  >
                    Pay Now 💳
                  </Button>
                )}
              </Box>
            </>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
