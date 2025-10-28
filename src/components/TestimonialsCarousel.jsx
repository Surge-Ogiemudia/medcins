import React from "react";
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Slider from "react-slick";

const testimonials = [
  {
    name: "Ada O.",
    text: "Medcins made it so easy to get my medicines delivered. Fast, reliable, and affordable!",
    avatar: "https://randomuser.me/api/portraits/men/76.jpg", // Black woman stock photo alternative
    city: "Lagos"
  },
  {
    name: "Chinedu E.",
    text: "I love the variety and the prices. Customer support is top notch!",
    avatar: "https://randomuser.me/api/portraits/men/77.jpg", // Black man
    city: "Abuja"
  },
  {
    name: "Fatima S.",
    text: "I found rare medicines here that I couldn't get anywhere else. Highly recommend!",
    avatar: "https://randomuser.me/api/portraits/women/77.jpg", // Black woman
    city: "Kano"
  },
  {
    name: "Tunde A.",
    text: "The pharmacy partners are trustworthy and the delivery is always on time.",
    avatar: "https://randomuser.me/api/portraits/men/75.jpg", // Black man
    city: "Ibadan"
  }
];

const sliderSettings = {
  infinite: true,
  speed: 900,
  slidesToShow: 2,
  slidesToScroll: 1,
  autoplay: true,
  autoplaySpeed: 4000,
  arrows: false,
  responsive: [
    { breakpoint: 900, settings: { slidesToShow: 1 } }
  ]
};

export default function TestimonialsCarousel() {
  return (
    <Box sx={{ width: '100%', my: 6 }}>
      <Typography variant="h5" color="primary" sx={{ mb: 3, fontWeight: 700, textAlign: 'center' }}>
        What Our Customers Say
      </Typography>
      <Slider {...sliderSettings}>
        {testimonials.map((t, idx) => (
          <Box key={idx} sx={{ px: 2 }}>
            <Card sx={{ borderRadius: 3, boxShadow: 2, minHeight: 180, display: 'flex', flexDirection: 'column', alignItems: 'center', p: 2 }}>
              <Avatar src={t.avatar} alt={t.name} sx={{ width: 56, height: 56, mb: 1 }} />
              <CardContent sx={{ textAlign: 'center', p: 0 }}>
                <Typography variant="body1" sx={{ fontStyle: 'italic', mb: 1 }}>
                  "{t.text}"
                </Typography>
                <Typography variant="subtitle2" color="primary" fontWeight={700}>
                  {t.name} <span style={{ color: '#888', fontWeight: 400 }}>({t.city})</span>
                </Typography>
              </CardContent>
            </Card>
          </Box>
        ))}
      </Slider>
    </Box>
  );
}
