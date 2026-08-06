import ticketOutline from '../assets/ticket-outline.svg'
import ticketAurora from '../assets/ticket-aurora-pixel.png'
import qrCode from '../assets/qr-code.svg'
import './TicketCard.css'

export default function TicketCard({ className = '' }) {
  return (
    <div className={`ticket-card ${className}`}>
      <img className="ticket-card__outline" src={ticketOutline} alt="" />
      <img className="ticket-card__aurora" src={ticketAurora} alt="" />
      <p className="ticket-card__event">626 Night Market</p>
      <div className="ticket-card__name">
        <span>Jennifer</span>
        <span>Huang</span>
      </div>
      <div className="ticket-card__venue">
        <span>Chase Center, SF</span>
        <span>July 27th, 2026</span>
      </div>
      <p className="ticket-card__admission">General Admission</p>
      <img className="ticket-card__qr" src={qrCode} alt="Ticket QR code" />
      <p className="ticket-card__number">#14542436113</p>
    </div>
  )
}
