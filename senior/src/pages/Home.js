import React from 'react';
import '../style/Home.css';

const Home = ({ onGetStarted }) => {
  const pastPcs = [
    { 
      id: 1, 
      name: 'Gaming Beast', 
      img: '/Assets/pexels-nikhil-pawar-1051632-13260079.jpg', 
      specs: 'RTX 4080, i9-13900K, 32GB RAM' 
    },
    { 
      id: 2, 
      name: 'Content Creator', 
      img: '/Assets/pexels-danny-meneses-340146-943096.jpg', 
      specs: 'RTX 4070, Ryzen 9 7900X, 64GB RAM' 
    },
    { 
      id: 3, 
      name: 'Office Pro', 
      img: '/Assets/pexels-pixabay-38568.jpg', 
      specs: 'RTX 3060, i5-13600K, 16GB RAM' 
    }
  ];

const partners = [
  { 
    name: 'NVIDIA', 
    logo: '/Assets/Logo-nvidia-transparent-PNG.png',
    description: 'Graphics Cards'
  },
  { 
    name: 'ASUS', 
    logo: '/Assets/hd-asus-official-logo-transparent-png-701751694773683zhb9eu5zq3.png',
    description: 'Motherboards & Components'
  },
  { 
    name: 'MSI', 
    logo: '/Assets/kisspng-motherboard-micro-star-international-graphics-card-en-1713948556799.webp',
    description: 'Gaming Hardware'
  },
  { 
    name: 'Corsair', 
    logo: '/Assets/corsair-components-logo-video-games-computer-text-png-clipart-thumbnail.jpg',
    description: 'PC Components & Peripherals'
  },
  { 
    name: 'AMD', 
    logo: '/Assets/a8cc694774d5428747c9e7c92bed2504.jpg',
    description: 'Processors & Graphics'
  },
  { 
    name: 'Intel', 
    logo: '/Assets/kisspng-intel-m-2-solid-state-drive-serial-ata-nvm-express-intel-logo-5b3f3b3b00bc05.283063721530870587003.jpg',
    description: 'Processors & Technology'
  },
  { 
    name: 'Samsung', 
    logo: '/Assets/samsung-white-logo-png-image-701751694714054zbxkqcqh9p.png',
    description: 'Memory & Storage'
  }
];

  
  const testimonials = [
    { name: 'Alex S.', text: 'My gaming PC arrived perfectly assembled and runs all my games at max settings!' },
    { name: 'Sarah J.', text: 'The AI assistant made choosing the right components so easy. Great experience!' },
    { name: 'Mike T.', text: 'I was nervous about compatibility issues, but everything worked perfectly together.' }
  ];

  return (
    <div className="home">
      <section className="hero">
        <video 
          autoPlay 
          muted 
          loop 
          className="hero-video">

          <source src="/Assets/14098264_3840_2160_25fps.mp4" type="video/mp4" />
          Your browser does not support the video tag.
        </video>
        
        <div className="hero-content">
            <h2>Build Your Dream PC With Ease</h2>
            <p>We make building custom PCs simple by sending either pre-built systems or 100% compatible parts directly to your door.</p>
            <button className="cta-button" onClick={onGetStarted}>
              Start Building Now
            </button>
          </div>
      </section>

      <section className="past-builds">
          <h2>PCs We've Built</h2>
          <div className="builds-grid">
            {pastPcs.map(pc => (
              <div key={pc.id} className="build-card">
                <img 
                  src={pc.img} 
                  alt={pc.name}
                  className="build-image"
                />
                <h3>{pc.name}</h3>
                <p>{pc.specs}</p>
              </div>
            ))}
          </div>
      </section>

      <section className="partners">
          <h2>Trusted By Industry Leaders</h2>
          <div className="partners-grid">
{partners.map((partner, index) => (
  <div key={index} className="partner-logo">
    <img 
      src={partner.logo} 
      alt={partner.name}
      className="partner-image"
    />
    <p>{partner.name}</p>
    <span>{partner.description}</span>
  </div>
))}

          </div>
      </section>

      <section className="testimonials">
          <h2>What Our Customers Say</h2>
          <div className="testimonials-grid">
            {testimonials.map((testimonial, index) => (
              <div key={index} className="testimonial-card">
                <p>"{testimonial.text}"</p>
                <span>- {testimonial.name}</span>
              </div>
            ))}
          </div>
      </section>
    </div>
  );
};

export default Home;