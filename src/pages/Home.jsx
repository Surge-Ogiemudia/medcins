import { useEffect, useState, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardMedia from '@mui/material/CardMedia';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Avatar from '@mui/material/Avatar';
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";

import Slider from "react-slick";
import "../slick-global-imports";
import SupportChatButton from "../components/SupportChatButton";
import TestimonialsCarousel from "../components/TestimonialsCarousel";
import FooterNav from "../components/FooterNav";


export default function Home() {
  // Fetch preview products for medicines carousel
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "products"), (snapshot) => {
      const products = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPreviewProducts(products);
    });
    return () => unsub();
  }, []);
  // react-slick slider settings
  const medicineSliderSettings = {
    infinite: true,
    speed: 1200,
    slidesToShow: 1,
    slidesToScroll: 1,
    autoplay: true,
    autoplaySpeed: 2000,
    arrows: false,
    responsive: [
      { breakpoint: 1200, settings: { slidesToShow: 1 } },
      { breakpoint: 900, settings: { slidesToShow: 1 } },
      { breakpoint: 600, settings: { slidesToShow: 1 } },
    ],
  };
  const classSliderSettings = {
    infinite: true,
    speed: 1000,
    slidesToShow: 1,
    slidesToScroll: 1,
    autoplay: true,
    autoplaySpeed: 2200,
    arrows: false,
    centerMode: true,
    centerPadding: "60px",
    responsive: [
      { breakpoint: 1200, settings: { slidesToShow: 1, centerPadding: "40px" } },
      { breakpoint: 900, settings: { slidesToShow: 1, centerPadding: "20px" } },
      { breakpoint: 600, settings: { slidesToShow: 1, centerPadding: "10px" } },
    ],
  };
  // Carousel reset points (must be declared at top level, not inside useEffect)
  const [drugClasses, setDrugClasses] = useState([]);
  const [topPharmacies, setTopPharmacies] = useState([]);
  // Show all pharmacies in the carousel
  const medicineManagerPharmacies = topPharmacies;

  // Fetch unique pharmacy stores from Firestore
  useEffect(() => {
    // Only fetch users with a businessSlug (i.e., stores)
    const unsub = onSnapshot(collection(db, "users"), (snapshot) => {
      const stores = [];
      const seenSlugs = new Set();
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.businessSlug && !seenSlugs.has(data.businessSlug)) {
          stores.push({
            name: data.businessName || data.businessSlug,
            img: data.logoUrl || 'https://img.icons8.com/color/96/000000/pharmacy-shop.png',
            rating: data.rating || 4.5,
            slug: data.businessSlug
          });
          seenSlugs.add(data.businessSlug);
        }
      });
      setTopPharmacies(stores);
    });
    return () => unsub();
  }, []);

  // Slider settings for pharmacies carousel
  const pharmacySliderSettings = {
    infinite: true,
    speed: 1200,
    slidesToShow: 1,
    slidesToScroll: 1,
    autoplay: true,
    autoplaySpeed: 2200,
    arrows: false,
    responsive: [
      { breakpoint: 1200, settings: { slidesToShow: 1 } },
      { breakpoint: 900, settings: { slidesToShow: 1 } },
      { breakpoint: 600, settings: { slidesToShow: 1 } },
    ],
  };
  const [location, setLocation] = useState(null);
  const [error, setError] = useState("");
  const [previewProducts, setPreviewProducts] = useState([]);
  const [search, setSearch] = useState("");
  const navigate = useNavigate();

  // Fetch unique drug classes for categories
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "products"), (snapshot) => {
      const classSet = new Set();
      snapshot.docs.forEach(doc => {
        const c = doc.data().class;
        if (c && typeof c === 'string' && c.trim()) classSet.add(c.trim());
      });
      setDrugClasses(Array.from(classSet).sort());
    });
    return () => unsub();
  }, []);


  // Geolocation logic
  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const coords = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          setLocation(coords);
          localStorage.setItem("customerLocation", JSON.stringify(coords));
        },
        (err) => {
          setError("Location access denied. Please enable location services.");
        }
      );
    }
  }, []);

  // Add handleSearch function
  const handleSearch = (e) => {
    e.preventDefault();
    if (search.trim()) {
      navigate(`/shop?search=${encodeURIComponent(search.trim())}`);
    } else {
      navigate('/shop');
    }
  };

  return (
  <Container maxWidth="md" sx={{ minHeight: '80vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', overflowX: 'hidden', maxWidth: '100vw', padding: 0 }}>
      <Paper elevation={3} sx={{ p: 5, mt: 8, width: '100%', textAlign: 'center', borderRadius: 4, background: 'linear-gradient(135deg, #f4f6fa 60%, #e0e7ff 100%)' }}>
        {/* Welcome Section */}
        <Typography variant="h3" component="h1" fontWeight={700} color="primary" gutterBottom>
          🏠 Welcome to Pharmastack
        </Typography>

        <Typography variant="h6" color="text.secondary" gutterBottom>
          Making Medicine Accessible, Findable, and Available to All.
        </Typography>

        {/* Mission Statement - modern info box */}
        <Box
          sx={{
            position: 'relative',
            background: 'linear-gradient(90deg, #e0e7ff 0%, #f4f6fb 100%)',
            borderLeft: '6px solid #6366f1',
            borderRadius: 3,
            p: 2.5,
            my: 2.5,
            boxShadow: '0 2px 12px #c7d2fe22',
            color: '#2d3748',
            fontSize: 18,
            fontWeight: 500,
            textAlign: 'center',
            letterSpacing: 0.1,
            lineHeight: 1.6,
            maxWidth: 600,
            mx: 'auto',
            overflow: 'hidden',
          }}
        >
          <span style={{ color: '#6366f1', fontWeight: 700, fontSize: 20, display: 'block', marginBottom: 4 }}>Our Mission</span>
          <span style={{ position: 'relative', zIndex: 1 }}>
            We are solving the problem of inequitable access to medicines by building a digital map of real-time medicine availability—a connected ecosystem ensuring that no patient is left untreated because a drug is unavailable, unfindable, or inaccessible.
          </span>
          {/* Gloss shine effect */}
            <span
              style={{
                pointerEvents: 'none',
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                zIndex: 2,
                background: 'linear-gradient(120deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.7) 40%, rgba(255,255,255,0.2) 60%, rgba(255,255,255,0) 100%)',
                transform: 'translateX(-100%)',
                animation: 'gloss-move 7s cubic-bezier(.4,.6,.6,1) infinite',
              }}
            />
            <style>{`
              @keyframes gloss-move {
                0% { transform: translateX(-100%); }
                60% { transform: translateX(120%); }
                100% { transform: translateX(120%); }
              }
            `}</style>
        </Box>



        {/* Location */}
        <Box my={3}>
          {location ? (
            <Typography variant="body1" color="secondary">
              📍 Your location: <b>{location.lat.toFixed(4)}, {location.lng.toFixed(4)}</b>
            </Typography>
          ) : (
            <Typography variant="body2" color="text.disabled">
              {error || "Detecting your location..."}
            </Typography>
          )}
        </Box>

        {/* Search bar (now above medicines carousel) */}
        <Box component="form" onSubmit={handleSearch} sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 2, mt: 6, mb: 2 }}>
          <TextField
            variant="outlined"
            placeholder="Search drugs..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            sx={{ width: 320, background: '#fff', borderRadius: 2 }}
            size="medium"
          />
          <Button type="submit" variant="contained" color="primary" size="large" sx={{ px: 4, py: 1.5, borderRadius: 2, fontWeight: 600 }}>
            Search
          </Button>
        </Box>

        {/* Medicines carousel */}
        <Box sx={{ mb: 3, background: '#f8fafc', borderRadius: 2, minHeight: 220, px: 1, py: 2 }}>
          {previewProducts.length === 0 ? null : (
            <Slider {...medicineSliderSettings}>
              {previewProducts.map((product, idx) => (
                <Box key={product.id || idx} sx={{ px: 1 }}>
                  <Card sx={{ height: 220, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', p: 2 }}>
                    <CardMedia
                      component="img"
                      image={product.image || '/default-medicine.png'}
                      alt={product.name}
                      sx={{ width: 130, height: 130, objectFit: 'contain', mb: 1 }}
                    />
                    <CardContent sx={{ p: 0 }}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 600, textAlign: 'center' }}>
                        {product.name || 'Unnamed'}
                      </Typography>
                    </CardContent>
                  </Card>
                </Box>
              ))}
            </Slider>
          )}
        </Box>

        {/* Drug classes carousel */}
        <Typography variant="h5" color="primary" sx={{ mt: 6, mb: 2, fontWeight: 600 }}>
          Drug Classes
        </Typography>
        <Box sx={{ mb: 4, background: '#f8fafc', borderRadius: 2, minHeight: 80, px: 1, py: 2 }}>
          <Slider {...classSliderSettings}>
            {drugClasses.map((cat) => {
              // Find a representative product for this class
              const repProduct = previewProducts.find(p => p.class && p.class.trim() === cat);
              return (
                <Box key={cat}>
                  <Card
                    sx={{
                      width: 160,
                      height: 160,
                      px: 1,
                      borderRadius: '50%',
                      boxShadow: 3,
                      cursor: 'pointer',
                      transition: 'transform 0.2s, box-shadow 0.2s',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      p: 1,
                      m: '0 auto',
                      position: 'relative',
                      overflow: 'hidden',
                      bgcolor: 'linear-gradient(135deg, #e0e7ff 60%, #c7d2fe 100%)',
                      background: 'linear-gradient(135deg, #e0e7ff 60%, #c7d2fe 100%)',
                      '&:hover': {
                        transform: 'scale(1.07)',
                        boxShadow: 6,
                        bgcolor: 'linear-gradient(135deg, #a5b4fc 60%, #818cf8 100%)',
                        background: 'linear-gradient(135deg, #a5b4fc 60%, #818cf8 100%)',
                      },
                      '&:active': {
                        transform: 'scale(0.97)',
                        boxShadow: 1,
                      },
                    }}
                    onClick={() => navigate(`/shop?category=${encodeURIComponent(cat)}`)}
                  >
                    {repProduct && (
                      <Box
                        sx={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: '100%',
                          height: '100%',
                          opacity: 0.13,
                          zIndex: 1,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <img
                          src={repProduct.image || '/default-medicine.png'}
                          alt={repProduct.name || cat}
                          style={{ width: '90%', height: '90%', objectFit: 'contain', filter: 'grayscale(100%)' }}
                        />
                      </Box>
                    )}
                    <CardContent sx={{ textAlign: 'center', p: 0.5, zIndex: 2, position: 'relative' }}>
                      <Typography variant="h6" fontWeight={900} sx={{ color: '#3730a3', letterSpacing: 0.5, textShadow: '0 2px 8px #fff8', fontSize: '1.1rem', lineHeight: 1.1 }}>
                        {cat}
                      </Typography>
                    </CardContent>
                  </Card>
                </Box>
              );
            })}
          </Slider>
        </Box>

        {/* Top Pharmacies as Carousel */}
        <Typography variant="h5" color="primary" sx={{ mt: 4, mb: 2, fontWeight: 600 }}>
          Find Medicines at Retail Prices
        </Typography>
        <Box sx={{ mb: 4, background: '#f8fafc', borderRadius: 2, minHeight: 140, px: 1, py: 2 }}>
          {medicineManagerPharmacies.length === 0 ? null : (
            <Slider {...pharmacySliderSettings}>
              {medicineManagerPharmacies.map(pharm => (
                <Box key={pharm.slug} sx={{ px: 1 }}>
                  <Card
                    sx={{ minWidth: 180, maxWidth: 200, mx: 1, borderRadius: 3, boxShadow: 2, cursor: 'pointer', transition: 'transform 0.2s', '&:hover': { transform: 'scale(1.04)' } }}
                    onClick={() => navigate(`/store/${pharm.slug}`)}
                  >
                    <CardMedia component="img" height="80" image={pharm.img} alt={pharm.name} sx={{ objectFit: 'contain', pt: 2 }} />
                    <CardContent sx={{ textAlign: 'center', pb: 2 }}>
                      <Typography variant="subtitle1" fontWeight={600} noWrap>{pharm.name}</Typography>
                      <Typography variant="body2" color="text.secondary">⭐ {pharm.rating}</Typography>
                      <Button
                        size="small"
                        variant="outlined"
                        color="primary"
                        sx={{ mt: 1, borderRadius: 2 }}
                        onClick={e => {
                          e.stopPropagation();
                          navigate(`/store/${pharm.slug}`);
                        }}
                      >
                        Shop Now
                      </Button>
                    </CardContent>
                  </Card>
                </Box>
              ))}
            </Slider>
          )}
        </Box>


        <Button
          component={Link}
          to="/store"
          size="large"
          variant="contained"
          color="secondary"
          sx={{
            px: 5,
            py: 2,
            fontWeight: 'bold',
            fontSize: '1.2em',
            borderRadius: 3,
            boxShadow: 3,
            mt: 4,
            background: 'linear-gradient(90deg,#7c3aed,#4f46e5)',
            color: '#fff',
            '&:hover': {
              background: 'linear-gradient(90deg,#4f46e5,#7c3aed)',
            },
          }}
        >
          🔎 Find a pharmacy store near you
        </Button>
      </Paper>

  <TestimonialsCarousel />
  <SupportChatButton onClick={() => alert('Support chat coming soon!')} />
  <FooterNav />
    </Container>
  );
}
