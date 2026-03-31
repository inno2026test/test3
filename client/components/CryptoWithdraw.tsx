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
  ArrowDownFromLine, 
  CheckCircle, 
  AlertCircle, 
  ExternalLink,
  RefreshCw,
  AlertTriangle,
  Shield
} from 'lucide-react';
import { useWallet } from '@/contexts/WalletContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from 'sonner';

interface CryptoWithdrawProps {
  userBalance: number;
  onWithdraw?: (amount: number) => void;
}

const CryptoWithdraw: React.FC<CryptoWithdrawProps> = ({ userBalance, onWithdraw }) => {
  const { t } = useLanguage();
  const {
    walletState,
    connectMetaMask,
    withdrawUSDC,
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

    window.addEventListener('openMetaMaskWithdraw', handleOpenDialog);

    return () => {
      window.removeEventListener('openMetaMaskWithdraw', handleOpenDialog);
    };
  }, []);

  const handleWithdraw = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      toast.error('Bitte geben Sie einen gültigen Betrag ein');
      return;
    }

    const withdrawAmount = parseFloat(amount);
    
    if (withdrawAmount < 1) {
      toast.error('Mindestauszahlung: 1 USDC');
      return;
    }

    if (walletState.vaultBalance && parseFloat(walletState.vaultBalance) < withdrawAmount) {
      toast.error('Unzureichendes Guthaben im Vault');
      return;
    }

    // Double confirmation for withdrawals
    const confirmed = window.confirm(
      `Sind Sie sicher, dass Sie ${amount} USDC aus dem Vault auszahlen möchten?\n\n` +
      `Das USDC wird an Ihre verbundene Wallet (${walletState.address?.slice(0, 8)}...${walletState.address?.slice(-4)}) gesendet.`
    );

    if (!confirmed) return;

    const transaction = await withdrawUSDC(amount);
    
    if (transaction) {
      setAmount('');
      onWithdraw?.(withdrawAmount);
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
              Verbinden Sie Ihre MetaMask Wallet, um USDC auszuzahlen
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
              <span className="text-sm text-gray-600">Auszahlungsadresse:</span>
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
              <div className="bg-green-50 p-3 rounded-lg">
                <div className="text-xs text-green-600 uppercase font-medium">USDC im Vault</div>
                <div className="text-lg font-bold text-green-900">
                  {walletState.vaultBalance ? `${walletState.vaultBalance} USDC` : '0.00 USDC'}
                </div>
              </div>
              
              <div className="bg-blue-50 p-3 rounded-lg">
                <div className="text-xs text-blue-600 uppercase font-medium">Kontostand</div>
                <div className="text-lg font-bold text-blue-900">
                  ${userBalance.toFixed(2)}
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

  const renderWithdrawForm = () => {
    if (!walletState.isConnected || !walletState.isCorrectNetwork) {
      return null;
    }

    const vaultBalance = parseFloat(walletState.vaultBalance || '0');
    const maxWithdraw = Math.min(vaultBalance, userBalance);

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <ArrowDownFromLine className="h-5 w-5" />
            <span>USDC Auszahlung</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="withdraw-amount">Betrag (USDC)</Label>
            <Input
              id="withdraw-amount"
              type="number"
              placeholder="z.B. 10.50"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              min="1"
              max={maxWithdraw}
              step="0.01"
            />
            <div className="text-xs text-gray-500 mt-1">
              Mindestbetrag: 1 USDC • Max. verfügbar: {maxWithdraw.toFixed(2)} USDC
            </div>
          </div>

          {maxWithdraw <= 0 && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Kein verfügbares Guthaben für Auszahlung. Zahlen Sie zuerst USDC ein.
              </AlertDescription>
            </Alert>
          )}

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-sm">
              <strong>Auszahlungshinweise:</strong><br/>
              • USDC wird direkt an Ihre verbundene Wallet gesendet<br/>
              • Gas-Gebühren werden von Ihrem ETH-Guthaben abgezogen<br/>
              • Transaktion ist irreversibel nach Bestätigung
            </AlertDescription>
          </Alert>

          <Button 
            onClick={handleWithdraw}
            disabled={!amount || parseFloat(amount) <= 0 || parseFloat(amount) > maxWithdraw || maxWithdraw <= 0 || isTransacting}
            className="w-full"
            variant={parseFloat(amount || '0') > 0 ? "destructive" : "default"}
          >
            {isTransacting ? (
              <div className="flex items-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Verarbeitet...</span>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <ArrowDownFromLine className="h-4 w-4" />
                <span>USDC auszahlen</span>
              </div>
            )}
          </Button>

          {parseFloat(amount || '0') > 0 && parseFloat(amount || '0') <= maxWithdraw && (
            <div className="bg-gray-50 p-3 rounded-lg text-sm">
              <div className="flex justify-between">
                <span>Auszahlungsbetrag:</span>
                <span className="font-medium">{amount} USDC</span>
              </div>
              <div className="flex justify-between">
                <span>Zieladresse:</span>
                <span className="font-medium">{formatAddress(walletState.address!)}</span>
              </div>
              <div className="flex justify-between">
                <span>Netzwerk:</span>
                <span className="font-medium">Optimism</span>
              </div>
              <div className="flex justify-between">
                <span>Gas-Gebühren:</span>
                <span className="font-medium text-orange-600">~0.001 ETH</span>
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
          <Badge variant="destructive">MetaMask Auszahlung</Badge>
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
          <ArrowDownFromLine className="h-4 w-4" />
          <span>MetaMask</span>
        </Button>
      </DialogTrigger>
      
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <ArrowDownFromLine className="h-5 w-5" />
            <span>MetaMask Auszahlung</span>
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="bg-green-50 p-4 rounded-lg">
            <p className="text-sm text-green-800">
              Verfügbarer Kontostand: <strong>${userBalance.toFixed(2)}</strong>
            </p>
          </div>

          <Alert className="border-green-200 bg-green-50">
            <Shield className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              <strong>Sichere MetaMask Auszahlung</strong><br/>
              Direkte Auszahlung in Ihre MetaMask Wallet.
              Sie behalten die volle Kontrolle über Ihre Mittel.
            </AlertDescription>
          </Alert>

          {renderNetworkInfo()}
          {renderWalletConnection()}
          {renderWithdrawForm()}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CryptoWithdraw;
