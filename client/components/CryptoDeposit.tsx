import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Wallet, 
  ArrowUpFromLine, 
  CheckCircle, 
  AlertCircle, 
  ExternalLink,
  RefreshCw,
  AlertTriangle,
  Info
} from 'lucide-react';
import { useWallet } from '@/contexts/WalletContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from 'sonner';

interface CryptoDepositProps {
  userBalance: number;
  onDeposit?: (amount: number) => void;
}

const CryptoDeposit: React.FC<CryptoDepositProps> = ({ userBalance, onDeposit }) => {
  const { t } = useLanguage();
  const {
    walletState,
    connectMetaMask,
    depositUSDC,
    refreshBalances,
    isConnecting,
    isTransacting
  } = useWallet();

  const [isOpen, setIsOpen] = useState(false);
  const [amount, setAmount] = useState('');

  useEffect(() => {
    if (isOpen && walletState.isConnected && walletState.isCorrectNetwork) {
      refreshBalances();
    }
  }, [isOpen, walletState.isConnected, walletState.isCorrectNetwork]);

  // Listen for custom event to open dialog programmatically
  useEffect(() => {
    const handleOpenDialog = () => {
      setIsOpen(true);
    };

    window.addEventListener('openMetaMaskDeposit', handleOpenDialog);

    return () => {
      window.removeEventListener('openMetaMaskDeposit', handleOpenDialog);
    };
  }, []);

  const handleDeposit = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      toast.error('Bitte geben Sie einen gültigen Betrag ein');
      return;
    }

    const depositAmount = parseFloat(amount);

    if (depositAmount < 1) {
      toast.error('Mindesteinzahlung: 1 USDC');
      return;
    }

    if (walletState.usdcBalance && parseFloat(walletState.usdcBalance) < depositAmount) {
      toast.error('Unzureichendes USDC-Guthaben in Ihrer Wallet');
      return;
    }

    const transaction = await depositUSDC(amount);

    if (transaction) {
      setAmount('');
      onDeposit?.(depositAmount);
      // Dialog bleibt offen um Status zu zeigen
    }
  };

  const handleRefreshBalances = async () => {
    await refreshBalances();
    toast.success('Guthaben aktualisiert');
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const openEtherscan = () => {
    if (walletState.address) {
      window.open(`https://optimistic.etherscan.io/address/${walletState.address}`, '_blank');
    }
  };

  const renderWalletConnection = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Wallet className="h-5 w-5" />
          <span>MetaMask Verbindung</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!walletState.isConnected ? (
          <div className="text-center space-y-4">
            <div className="text-gray-600">
              Verbinden Sie Ihre MetaMask Wallet, um USDC einzuzahlen
            </div>
            <Button 
              onClick={connectMetaMask}
              disabled={isConnecting}
              className="w-full"
            >
              {isConnecting ? (
                <div className="flex items-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Verbindet...</span>
                </div>
              ) : (
                <div className="flex items-center space-x-2">
                  <Wallet className="h-4 w-4" />
                  <span>MetaMask verbinden</span>
                </div>
              )}
            </Button>
          </div>
        ) : !walletState.isCorrectNetwork ? (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Bitte wechseln Sie zu Optimism Mainnet in Ihrer Wallet
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Verbundene Adresse:</span>
              <div className="flex items-center space-x-2">
                <code className="text-sm bg-gray-100 px-2 py-1 rounded">
                  {formatAddress(walletState.address!)}
                </code>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={openEtherscan}
                >
                  <ExternalLink className="h-3 w-3" />
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-blue-50 p-3 rounded-lg">
                <div className="text-xs text-blue-600 uppercase font-medium">USDC in Wallet</div>
                <div className="text-lg font-bold text-blue-900">
                  {walletState.usdcBalance ? `${walletState.usdcBalance} USDC` : '0.00 USDC'}
                </div>
              </div>
              
              <div className="bg-green-50 p-3 rounded-lg">
                <div className="text-xs text-green-600 uppercase font-medium">USDC im Vault</div>
                <div className="text-lg font-bold text-green-900">
                  {walletState.vaultBalance ? `${walletState.vaultBalance} USDC` : '0.00 USDC'}
                </div>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleRefreshBalances}
              className="w-full"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Guthaben aktualisieren
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );

  const renderDepositForm = () => {
    if (!walletState.isConnected || !walletState.isCorrectNetwork) {
      return null;
    }

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <ArrowUpFromLine className="h-5 w-5" />
            <span>USDC Einzahlung</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="deposit-amount">Betrag (USDC)</Label>
            <Input
              id="deposit-amount"
              type="number"
              placeholder="z.B. 10.50"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              min="1"
              step="0.01"
            />
            <div className="text-xs text-gray-500 mt-1">
              Mindestbetrag: 1 USDC • Verfügbar: {walletState.usdcBalance || '0'} USDC
            </div>
          </div>

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-sm">
              <strong>Transaktionsablauf:</strong><br/>
              1. USDC-Freigabe für Vault-Contract<br/>
              2. Einzahlung in den Vault<br/>
              3. Automatische Gutschrift in Ihrem Account
            </AlertDescription>
          </Alert>

          <Button 
            onClick={handleDeposit}
            disabled={!amount || parseFloat(amount) <= 0 || isTransacting}
            className="w-full"
          >
            {isTransacting ? (
              <div className="flex items-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Verarbeitet...</span>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-4 w-4" />
                <span>USDC einzahlen</span>
              </div>
            )}
          </Button>

          {parseFloat(amount || '0') > 0 && (
            <div className="bg-gray-50 p-3 rounded-lg text-sm">
              <div className="flex justify-between">
                <span>Einzahlungsbetrag:</span>
                <span className="font-medium">{amount} USDC</span>
              </div>
              <div className="flex justify-between">
                <span>Netzwerk:</span>
                <span className="font-medium">Optimism</span>
              </div>
              <div className="flex justify-between">
                <span>Gas-Gebühren:</span>
                <span className="font-medium">Zahlen Sie selbst</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  const renderNetworkInfo = () => (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-red-500 rounded-full"></div>
            <span className="text-sm font-medium">Optimism Mainnet</span>
          </div>
          <Badge variant="secondary">MetaMask USDC</Badge>
        </div>
        <div className="text-xs text-gray-500 mt-2">
          Niedrige Gas-Gebühren • Schnelle Bestätigungen
        </div>
      </CardContent>
    </Card>
  );

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button className="flex items-center space-x-2" variant="outline">
          <Wallet className="h-4 w-4" />
          <span>MetaMask</span>
        </Button>
      </DialogTrigger>
      
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Wallet className="h-5 w-5" />
            <span>MetaMask Einzahlung</span>
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="bg-blue-50 p-4 rounded-lg">
            <p className="text-sm text-blue-800">
              Aktueller Kontostand: <strong>${userBalance.toFixed(2)}</strong>
            </p>
          </div>

          <Alert className="border-blue-200 bg-blue-50">
            <Info className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-800">
              <strong>MetaMask Direktzugang</strong><br/>
              Zahlen Sie direkt mit USDC aus Ihrer MetaMask Wallet ein.
              Volle Kontrolle über Ihre Transaktionen.
            </AlertDescription>
          </Alert>

          {renderNetworkInfo()}
          {renderWalletConnection()}
          {renderDepositForm()}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CryptoDeposit;
