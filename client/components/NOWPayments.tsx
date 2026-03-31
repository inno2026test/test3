import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Wallet, 
  ArrowUpFromLine, 
  ArrowDownFromLine, 
  ExternalLink,
  Info,
  Shield
} from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from 'sonner';

interface NOWPaymentsProps {
  userBalance: number;
  onTransaction?: (type: 'deposit' | 'withdrawal', amount?: number) => void;
}

const NOWPayments: React.FC<NOWPaymentsProps> = ({ userBalance, onTransaction }) => {
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);

  const openNOWPayments = () => {
    // Open NOWPayments in a new window/tab
    const paymentWindow = window.open(
      'https://nowpayments.io/payment/?iid=5853137966&source=button',
      '_blank',
      'noopener,noreferrer'
    );

    if (paymentWindow) {
      toast.success('NOWPayments geöffnet - Zahlung wird in neuem Tab verarbeitet');
      onTransaction?.('deposit');
    } else {
      toast.error('Pop-up blockiert - Bitte erlauben Sie Pop-ups für diese Seite');
    }
  };

  const renderPaymentInfo = () => (
    <div className="space-y-4">
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          <strong>NOWPayments Integration</strong><br/>
          Sichere Krypto-Zahlungen mit über 300+ unterstützten Coins und Tokens.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Shield className="h-5 w-5 text-green-600" />
            <span>Unterstützte Kryptowährungen</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
            <Badge variant="outline">Bitcoin (BTC)</Badge>
            <Badge variant="outline">Ethereum (ETH)</Badge>
            <Badge variant="outline">USDT</Badge>
            <Badge variant="outline">USDC</Badge>
            <Badge variant="outline">Litecoin (LTC)</Badge>
            <Badge variant="outline">BNB</Badge>
            <Badge variant="outline">Dogecoin (DOGE)</Badge>
            <Badge variant="outline">Cardano (ADA)</Badge>
            <Badge variant="outline">Solana (SOL)</Badge>
            <Badge variant="outline">+ 300 mehr</Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <ArrowUpFromLine className="h-5 w-5 text-blue-600" />
            <span>Krypto-Einzahlung</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-blue-50 p-4 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Aktueller Kontostand:</strong> ${userBalance.toFixed(2)}
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Mindestbetrag:</span>
              <span className="font-medium">$1.00</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Maximaler Betrag:</span>
              <span className="font-medium">$50,000</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Verarbeitungszeit:</span>
              <span className="font-medium">Sofort - 60 Min</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Netzwerkgebühren:</span>
              <span className="font-medium">Nach Blockchain</span>
            </div>
          </div>

          <Alert className="border-green-200 bg-green-50">
            <Shield className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              <strong>Sicher & Automatisch:</strong><br/>
              • Automatische Gutschrift nach Bestätigung<br/>
              • KYC-frei für Beträge unter $2,000<br/>
              • SSL-verschlüsselt und PCI-DSS konform
            </AlertDescription>
          </Alert>

          {/* NOWPayments Button */}
          <div className="pt-4 border-t">
            {/* Official NOWPayments Button */}
            <div className="text-center mb-4">
              <a
                href="https://nowpayments.io/payment/?iid=5853137966&source=button"
                target="_blank"
                rel="noreferrer noopener"
                onClick={() => {
                  toast.success('NOWPayments geöffnet - Zahlung wird in neuem Tab verarbeitet');
                  onTransaction?.('deposit');
                }}
              >
                <img
                  src="https://nowpayments.io/images/embeds/payment-button-black.svg"
                  alt="Krypto-Zahlungsbutton von NOWPayments"
                  className="w-full max-w-sm mx-auto hover:opacity-90 transition-opacity duration-200 cursor-pointer"
                />
              </a>
            </div>

            {/* Custom Button Alternative */}
            <Button
              onClick={openNOWPayments}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold py-3 px-6 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200"
            >
              <div className="flex items-center justify-center space-x-3">
                <Wallet className="h-5 w-5" />
                <span>Alternative: Mit Krypto bezahlen</span>
                <ExternalLink className="h-4 w-4" />
              </div>
            </Button>

            <div className="text-center mt-3">
              <p className="text-xs text-gray-500">
                Powered by NOWPayments • Über 300 Kryptowährungen
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Zahlungsablauf</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <div className="flex items-start space-x-3">
              <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">1</div>
              <div>
                <p className="font-medium">Krypto-Zahlung initiieren</p>
                <p className="text-gray-600">Klicken Sie auf "Mit Krypto bezahlen"</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">2</div>
              <div>
                <p className="font-medium">Betrag und Coin wählen</p>
                <p className="text-gray-600">Wählen Sie Ihre bevorzugte Kryptowährung</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">3</div>
              <div>
                <p className="font-medium">Zahlung senden</p>
                <p className="text-gray-600">Senden Sie Krypto an die angegebene Adresse</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-xs font-bold">4</div>
              <div>
                <p className="font-medium">Automatische Gutschrift</p>
                <p className="text-gray-600">Ihr Guthaben wird nach Bestätigung gutgeschrieben</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="text-center">
        <p className="text-xs text-gray-500">
          Bei Fragen zur Zahlung kontaktieren Sie unseren Support.<br/>
          NOWPayments ist ein lizenzierter Krypto-Zahlungsdienstleister.
        </p>
      </div>
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button className="flex items-center space-x-2" variant="outline">
          <Wallet className="h-4 w-4" />
          <span>Krypto</span>
        </Button>
      </DialogTrigger>
      
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Wallet className="h-5 w-5" />
            <span>Krypto-Zahlungen</span>
            <Badge variant="secondary" className="ml-2">NOWPayments</Badge>
          </DialogTitle>
        </DialogHeader>
        
        {renderPaymentInfo()}
      </DialogContent>
    </Dialog>
  );
};

export default NOWPayments;
