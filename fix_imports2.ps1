# Fix remaining unused imports based on build errors

$fixes = @{
  # BookingDetailsPage: remove Paper and Divider from @mantine/core line 5
  'features\bookings\BookingDetailsPage.tsx' = @(
    @{ Old = ", Paper"; New = "" },
    @{ Old = ", Divider"; New = "" }
  )
  # BookingsPage: remove RefreshCw from lucide-react
  'features\bookings\BookingsPage.tsx' = @(
    @{ Old = ", RefreshCw"; New = "" }
  )
  # DashboardStats: remove BedDouble, Plane, Building2, loading, isAdmin, isManager - complex
  # These are removed in the function body too, better handled manually
  # ExpensesList: remove Select, Badge, Progress
  'features\expenses\ExpensesList.tsx' = @(
    @{ Old = ", Select"; New = "" },
    @{ Old = ", Badge"; New = "" },
    @{ Old = ", Progress"; New = "" }
  )
  # PrepaymentBalances: remove ExpenseForm import
  'features\expenses\PrepaymentBalances.tsx' = @(
    @{ Old = "import { ExpenseForm } from './ExpenseForm';`r`n"; New = "" },
    @{ Old = "import { ExpenseForm } from './ExpenseForm';`n"; New = "" }
  )
  # FlightInventoryPage: setFlightFilter handled with _ prefix
  # PilgrimsPage: remove Box
  'features\pilgrims\PilgrimsPage.tsx' = @(
    @{ Old = ", Box"; New = "" }
  )
  # ReportsPage: remove Box, Progress from @mantine (line 5), FileText, HandCoins from lucide, setIsAdmin
  'features\reports\ReportsPage.tsx' = @(
    @{ Old = ", Box"; New = "" },
    @{ Old = ", Progress"; New = "" },
    @{ Old = "  FileText, "; New = "  " },
    @{ Old = ",`r`n  Send, HandCoins"; New = "" },
    @{ Old = ",`n  Send, HandCoins"; New = "" },
    @{ Old = ", HandCoins"; New = "" },
    @{ Old = "  FileText,"; New = "" }
  )
  # HandoverStatusModal: index unused
  # HotelInventoryPage: setAccommodationFilter, setRoomTypeFilter
  # DiscountSettings: Tooltip
  'features\settings\DiscountSettings.tsx' = @(
    @{ Old = ", Tooltip"; New = "" }
  )
  # PreferencesSettings: user
  # ProfileSettings: user
  # TeamManagement: Divider
  'features\settings\TeamManagement.tsx' = @(
    @{ Old = ", Divider"; New = "" }
  )
  # AgencySettings: agency
  # HotelInventoryForm: required on Text
}

foreach ($file in $fixes.Keys) {
  $path = "D:\Traveling\frontend\src\$file"
  if (Test-Path $path) {
    $content = [System.IO.File]::ReadAllText($path)
    foreach ($fix in $fixes[$file]) {
      $content = $content.Replace($fix.Old, $fix.New)
    }
    [System.IO.File]::WriteAllText($path, $content)
    Write-Host "Fixed: $file"
  }
}
