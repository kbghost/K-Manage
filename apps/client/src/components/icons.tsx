import type { ComponentType, SVGAttributes } from "react";
import {
  PiArchiveDuotone, PiArrowCounterClockwiseDuotone, PiMoneyDuotone, PiBarcodeDuotone, PiBellDuotone, PiCameraDuotone, PiCaretLeftDuotone, PiCaretRightDuotone,
  PiChartBarDuotone, PiCheckCircleDuotone, PiClipboardTextDuotone, PiClockCounterClockwiseDuotone, PiCommandDuotone, PiCreditCardDuotone, PiCubeDuotone, PiDownloadSimpleDuotone,
  PiEyeDuotone, PiEyeSlashDuotone, PiFireDuotone, PiGearSixDuotone, PiHandCoinsDuotone, PiInfoDuotone, PiKeyboardDuotone, PiLightbulbDuotone, PiLightningDuotone, PiListDuotone, PiLockKeyDuotone, PiMagnifyingGlassDuotone,
  PiMinusDuotone, PiMoonDuotone, PiPackageDuotone, PiPaperclipDuotone, PiPencilSimpleDuotone, PiPercentDuotone, PiPlusDuotone, PiPrinterDuotone, PiProhibitDuotone, PiReceiptDuotone,
  PiRocketLaunchDuotone, PiScrollDuotone, PiShieldCheckDuotone, PiShieldWarningDuotone, PiShoppingBagDuotone, PiShoppingCartDuotone, PiSignOutDuotone, PiSparkleDuotone,
  PiSpinnerGapDuotone, PiSquaresFourDuotone, PiStorefrontDuotone, PiSunDuotone, PiTagDuotone, PiTargetDuotone, PiTrashDuotone, PiTrendUpDuotone, PiTrophyDuotone, PiTruckDuotone,
  PiUploadSimpleDuotone, PiUserCircleDuotone, PiUserPlusDuotone, PiUsersDuotone, PiUsersThreeDuotone, PiWalletDuotone, PiWarehouseDuotone, PiWarningDuotone, PiWrenchDuotone,
  PiXCircleDuotone, PiXDuotone, PiArrowRightDuotone, PiHouseDuotone, PiConfettiDuotone, PiCalendarCheckDuotone, PiMedalDuotone, PiQuestionDuotone,
} from "react-icons/pi";

/**
 * Icônes Phosphor nettes et propres (monochromes, sans couleur secondaire parasite).
 * Voir index.css (.duo).
 */
export type IconType = ComponentType<SVGAttributes<SVGElement> & { className?: string }>;
const duo = (C: IconType): IconType => function DuoIcon({ className, ...p }) { return <C aria-hidden focusable="false" {...p} className={`duo ${className ?? ""}`.trim()} />; };

export const AlertTriangle = duo(PiWarningDuotone); export const Archive = duo(PiArchiveDuotone); export const Ban = duo(PiProhibitDuotone);
export const Banknote = duo(PiMoneyDuotone); export const BarChart3 = duo(PiChartBarDuotone); export const Bell = duo(PiBellDuotone); export const Boxes = duo(PiCubeDuotone);
export const Camera = duo(PiCameraDuotone); export const CheckCircle2 = duo(PiCheckCircleDuotone); export const ChevronLeft = duo(PiCaretLeftDuotone); export const ChevronRight = duo(PiCaretRightDuotone);
export const ClipboardCheck = duo(PiClipboardTextDuotone); export const ClipboardList = duo(PiClipboardTextDuotone); export const CreditCard = duo(PiCreditCardDuotone);
export const Download = duo(PiDownloadSimpleDuotone); export const HandCoins = duo(PiHandCoinsDuotone); export const History = duo(PiClockCounterClockwiseDuotone); export const Info = duo(PiInfoDuotone);
export const Eye = duo(PiEyeDuotone); export const EyeSlash = duo(PiEyeSlashDuotone);
export const LayoutDashboard = duo(PiSquaresFourDuotone); export const Loader2 = duo(PiSpinnerGapDuotone); export const LockKeyhole = duo(PiLockKeyDuotone); export const LogOut = duo(PiSignOutDuotone);
export const Menu = duo(PiListDuotone); export const Minus = duo(PiMinusDuotone); export const Package = duo(PiPackageDuotone); export const PackageCheck = duo(PiPackageDuotone);
export const PackageSearch = duo(PiMagnifyingGlassDuotone); export const PackageX = duo(PiXCircleDuotone); export const Paperclip = duo(PiPaperclipDuotone); export const Pencil = duo(PiPencilSimpleDuotone);
export const Percent = duo(PiPercentDuotone); export const Plus = duo(PiPlusDuotone); export const Printer = duo(PiPrinterDuotone); export const Receipt = duo(PiReceiptDuotone);
export const RotateCcw = duo(PiArrowCounterClockwiseDuotone); export const ScanLine = duo(PiBarcodeDuotone); export const ScrollText = duo(PiScrollDuotone); export const Search = duo(PiMagnifyingGlassDuotone);
export const Settings = duo(PiGearSixDuotone); export const ShieldAlert = duo(PiShieldWarningDuotone); export const ShieldCheck = duo(PiShieldCheckDuotone); export const ShoppingBag = duo(PiShoppingBagDuotone);
export const ShoppingCart = duo(PiShoppingCartDuotone); export const Store = duo(PiStorefrontDuotone); export const Tags = duo(PiTagDuotone); export const Trash2 = duo(PiTrashDuotone);
export const TrendingUp = duo(PiTrendUpDuotone); export const Truck = duo(PiTruckDuotone); export const Upload = duo(PiUploadSimpleDuotone); export const UserCircle = duo(PiUserCircleDuotone);
export const UserPlus = duo(PiUserPlusDuotone); export const Users = duo(PiUsersDuotone); export const UsersRound = duo(PiUsersThreeDuotone); export const Wallet = duo(PiWalletDuotone);
export const Warehouse = duo(PiWarehouseDuotone); export const Wrench = duo(PiWrenchDuotone); export const X = duo(PiXDuotone);
// Nouvelles icones (fonctionnalites d'engagement)
export const Command = duo(PiCommandDuotone); export const Keyboard = duo(PiKeyboardDuotone); export const Lightbulb = duo(PiLightbulbDuotone); export const Lightning = duo(PiLightningDuotone);
export const Moon = duo(PiMoonDuotone); export const Sun = duo(PiSunDuotone); export const Fire = duo(PiFireDuotone); export const Target = duo(PiTargetDuotone); export const Trophy = duo(PiTrophyDuotone);
export const Sparkle = duo(PiSparkleDuotone); export const Rocket = duo(PiRocketLaunchDuotone); export const ArrowRight = duo(PiArrowRightDuotone); export const Home = duo(PiHouseDuotone);
export const Confetti = duo(PiConfettiDuotone); export const CalendarCheck = duo(PiCalendarCheckDuotone); export const Medal = duo(PiMedalDuotone); export const Help = duo(PiQuestionDuotone);
