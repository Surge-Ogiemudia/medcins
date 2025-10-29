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
    text: "Pharmastack made it so easy to get my medicines delivered. Fast, reliable, and affordable!",
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

export default function TestimonialsCarousel() {
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 600;
  const settings = {
    dots: true,
    infinite: true,
    speed: 500,
    slidesToShow: 2,
    slidesToScroll: 1,
    autoplay: true,
    autoplaySpeed: 4000,
    arrows: false,
    responsive: [
      {
        breakpoint: 900,
        settings: {
          slidesToShow: 1,
        },
      },
      {
        breakpoint: 600,
        settings: {
          slidesToShow: 1,
          centerMode: false,
          variableWidth: false,
        },
      },
    ],
  };
  return (
    <div style={{
      maxWidth: 900,
      margin: '0 auto',
      padding: isMobile ? '12px 0' : '32px 0',
    }}>
      <Slider {...settings}>
        {testimonials.map((t, idx) => (
          <div key={idx} style={{
            padding: isMobile ? 12 : 24,
            background: '#fff',
            borderRadius: 16,
            boxShadow: '0 2px 12px #c7d2fe22',
            margin: isMobile ? '0 2px' : '0 8px',
            minHeight: isMobile ? 120 : 180,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{ fontSize: isMobile ? 15 : 18, fontWeight: 600, color: '#2d3748', marginBottom: 8 }}>{t.name}</div>
            <div style={{ fontSize: isMobile ? 12 : 15, color: '#6366f1', marginBottom: 8 }}>{t.city}</div>
            <div style={{ fontSize: isMobile ? 13 : 16, color: '#222', fontStyle: 'italic' }}>&ldquo;{t.text}&rdquo;</div>
          </div>
        ))}
      </Slider>
    </div>
  );
}
