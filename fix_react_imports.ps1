$files = @(
  'features\bookings\BookingDetailsPage.tsx',
  'features\bookings\BookingInvoicePage.tsx',
  'features\bookings\BookingPaymentPage.tsx',
  'features\bookings\BookingRoomsPage.tsx',
  'features\bookings\BookingsPage.tsx',
  'features\bookings\DeleteBookingModal.tsx',
  'features\clients\ClientsPage.tsx',
  'features\expenses\ExpenseCategories.tsx',
  'features\expenses\ExpensesList.tsx',
  'features\expenses\PrepaymentBalances.tsx',
  'features\inventory\FlightInventoryForm.tsx',
  'features\inventory\HotelInventoryForm.tsx',
  'features\inventory\HotelInventoryPage.tsx',
  'features\pilgrims\PilgrimsPage.tsx',
  'features\reports\HandoverFormModal.tsx',
  'features\reports\HandoversList.tsx',
  'features\reports\HandoverStatusModal.tsx',
  'features\reports\ReportsPage.tsx',
  'features\seasons\SeasonsList.tsx',
  'features\settings\AgencySettings.tsx',
  'features\settings\BranchManagement.tsx',
  'features\settings\DiscountSettings.tsx',
  'features\settings\EmailSettings.tsx',
  'features\settings\PreferencesSettings.tsx',
  'features\settings\ProfileSettings.tsx',
  'features\settings\SecuritySettings.tsx',
  'features\settings\SettingsPage.tsx',
  'features\settings\SMSSettings.tsx',
  'features\settings\TeamManagement.tsx',
  'features\inventory\FlightInventoryPage.tsx',
  'features\dashboard\DashboardStats.tsx',
  'features\flights\FlightsList.tsx'
)
foreach ($f in $files) {
  $path = "D:\Traveling\frontend\src\$f"
  if (Test-Path $path) {
    $content = [System.IO.File]::ReadAllText($path)
    $content = $content -replace "import React from 'react';\r\n", ''
    $content = $content -replace "import React from 'react';\n", ''
    $content = $content -replace "import React, \{", 'import {'
    [System.IO.File]::WriteAllText($path, $content)
    Write-Host "Fixed: $f"
  }
}
