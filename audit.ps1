# PG Residence App - audit up to Phase 3
# Run from the project root:   powershell -ExecutionPolicy Bypass -File .\audit.ps1
# It only READS your project. It changes nothing except writing audit-report.txt.

$root = (Get-Location).Path
$src  = Join-Path $root 'src'
if (-not (Test-Path $src)) { Write-Host "Run this from C:\Pgmobile\pg-residence-app (the folder that contains src)"; exit 1 }

$out = New-Object System.Collections.Generic.List[string]
function Say($t) { Write-Host $t; $out.Add($t) }

$allFiles = Get-ChildItem -Path $src -Recurse -File -Include *.ts,*.tsx

function FindFile($name) {
  $m = $allFiles | Where-Object { $_.Name -eq $name } | Select-Object -First 1
  if ($m) { return $m.FullName.Substring($root.Length + 1) } else { return $null }
}
function FileCheck($label, $name) {
  $p = FindFile $name
  if ($p) { Say ("  [OK]      {0,-34} {1}" -f $label, $p) } else { Say ("  [MISSING] {0,-34} {1}" -f $label, $name) }
}
# Is a text present in a given file (found by name)?
function TextCheck($label, $name, $pattern) {
  $p = FindFile $name
  if (-not $p) { Say ("  [MISSING] {0,-34} file {1} not found" -f $label, $name); return }
  $hit = Select-String -Path (Join-Path $root $p) -Pattern $pattern -SimpleMatch -Quiet
  if ($hit) { Say ("  [OK]      {0}" -f $label) } else { Say ("  [MISSING] {0,-34} not found in {1}" -f $label, $name) }
}
# Is a text present anywhere in src?
function AnyCheck($label, $pattern) {
  $hit = $allFiles | Select-String -Pattern $pattern -SimpleMatch -List | Select-Object -First 1
  if ($hit) { Say ("  [OK]      {0,-34} e.g. {1}" -f $label, $hit.Path.Substring($root.Length + 1)) }
  else { Say ("  [NONE]    {0,-34} no match for: {1}" -f $label, $pattern) }
}

Say "=============== PG RESIDENCE APP AUDIT ==============="
Say ("Date: " + (Get-Date))
Say ""

Say "--- PHASE 1: Core resident portal ---"
FileCheck 'Home'                  'HomeScreen.tsx'
FileCheck 'Stay overview card'    'StayOverviewCard.tsx'
FileCheck 'Profile'               'ProfileScreen.tsx'
FileCheck 'Edit profile'          'EditProfileScreen.tsx'
FileCheck 'Stay & Room details'   'StayDetailsScreen.tsx'
FileCheck 'Rent details'          'RentDetailsScreen.tsx'
FileCheck 'Pay rent'              'PayRentScreen.tsx'
FileCheck 'Payment success'       'PaymentSuccessScreen.tsx'
FileCheck 'Notices'               'NoticesScreen.tsx'
FileCheck 'Notifications'         'NotificationsScreen.tsx'
FileCheck 'Notice read state'     'noticeReads.ts'
FileCheck 'Notice categories'     'noticeCategories.ts'
FileCheck 'Settings'              'SettingsScreen.tsx'
FileCheck 'App settings store'    'appSettings.ts'
FileCheck 'Inactivity guard'      'InactivityGuard.tsx'
Say ""

Say "--- PHASE 2: Resident services ---"
FileCheck 'Complaints list'       'ComplaintsListScreen.tsx'
FileCheck 'New complaint'         'NewComplaintScreen.tsx'
FileCheck 'Admin complaints'      'AdminComplaintsScreen.tsx'
FileCheck 'Visitors'              'VisitorsScreen.tsx'
FileCheck 'New visitor'           'NewVisitorScreen.tsx'
FileCheck 'Admin visitors'        'AdminVisitorsScreen.tsx'
FileCheck 'Admin visitors hook'   'useAdminVisitors.ts'
FileCheck 'Food (resident)'       'FoodScreen.tsx'
FileCheck 'Food (admin)'          'AdminFoodMenuScreen.tsx'
FileCheck 'Laundry (admin)'       'AdminLaundryScreen.tsx'
FileCheck 'Laundry hook'          'useLaundry.ts'
$lau = $allFiles | Where-Object { $_.Name -like '*Laundry*' -and $_.Name -notlike 'Admin*' -and $_.Name -ne 'useLaundry.ts' } | Select-Object -First 3
if ($lau) { foreach ($f in $lau) { Say ("  [OK]      Laundry (resident)                 " + $f.FullName.Substring($root.Length + 1)) } }
else { Say "  [MISSING] Laundry (resident)                 no resident Laundry screen found" }
FileCheck 'Help & Support'        'HelpSupportScreen.tsx'
FileCheck 'Support chat/ticket'   'SupportChatScreen.tsx'
FileCheck 'Admin support'         'AdminSupportScreen.tsx'
FileCheck 'Support tickets hook'  'useSupportTickets.ts'
Say ""

Say "--- PHASE 3: Resident operations ---"
FileCheck 'Vacate notice (res)'   'VacateNoticeScreen.tsx'
FileCheck 'Admin vacating'        'AdminVacatingScreen.tsx'
AnyCheck  'Exit: refund calc'     'refund'
AnyCheck  'Exit: settlement'      'settlement'
AnyCheck  'Exit: inspection'      'inspection'
AnyCheck  'Exit: checklist'       'checklist'
AnyCheck  'Exit: approve/reject'  'approveVacate'
AnyCheck  'Exit: checkout done'   'completeCheckout'
FileCheck 'Documents (resident)'  'DocumentsScreen.tsx'
FileCheck 'Documents context'     'DocumentsContext.tsx'
FileCheck 'Document card'         'DocumentCard.tsx'
$adminDoc = $allFiles | Where-Object { $_.Name -like 'Admin*Document*' } | Select-Object -First 3
if ($adminDoc) { foreach ($f in $adminDoc) { Say ("  [OK]      Admin documents                    " + $f.FullName.Substring($root.Length + 1)) } }
else { Say "  [MISSING] Admin documents                    none" }
FileCheck 'Facilities (resident)' 'FacilitiesScreen.tsx'
FileCheck 'Facilities (admin)'    'AdminFacilitiesScreen.tsx'
FileCheck 'Facilities hook'       'useFacilities.ts'
FileCheck 'Feedback (resident)'   'FeedbackScreen.tsx'
FileCheck 'Feedback (admin)'      'AdminFeedbackScreen.tsx'
FileCheck 'Feedback hook'         'useFeedback.ts'
FileCheck 'Rules (resident)'      'RulesScreen.tsx'
FileCheck 'Rules (admin)'         'AdminRulesScreen.tsx'
FileCheck 'Rules hook'            'useRules.ts'
Say ""

Say "--- RENT / PAYMENTS (spec section 4) ---"
AnyCheck  'UPI deep link'         'upi://'
AnyCheck  'Razorpay'              'razorpay'
AnyCheck  'Partially Paid status' 'Partially Paid'
AnyCheck  'Under Verification'    'Under Verification'
AnyCheck  'Late fee'              'lateFee'
AnyCheck  'Deposit refund'        'refundable'
AnyCheck  'Advance balance'       'advanceBalance'
AnyCheck  'Receipt PDF'           'printToFileAsync'
Say ""

Say "--- WIRING: resident navigator (AppNavigator.tsx) ---"
foreach ($r in 'Settings','Facilities','Feedback','Rules','Laundry','Documents','StayDetails','VacateNotice','Visitors','Complaints','Food','HelpSupport','SupportChat') {
  TextCheck ("route " + $r) 'AppNavigator.tsx' ('name="' + $r + '"')
}
Say ""
Say "--- WIRING: route types (navigation.ts) ---"
foreach ($r in 'Settings','Facilities','Feedback','Rules','Laundry') {
  TextCheck ("type " + $r) 'navigation.ts' ($r + ':')
}
Say ""
Say "--- WIRING: Profile menu (ProfileScreen.tsx) ---"
foreach ($l in 'Settings','Facilities & Info','Feedback','Rules & Regulations','Laundry') {
  TextCheck ("menu " + $l) 'ProfileScreen.tsx' ("label: '" + $l + "'")
}
Say ""
Say "--- WIRING: admin navigator (AdminStackNavigator.tsx) ---"
foreach ($r in 'AdminVisitors','AdminFoodMenu','AdminSupport','AdminLaundry','AdminFacilities','AdminFeedback','AdminRules','AdminVacating') {
  TextCheck ("route " + $r) 'AdminStackNavigator.tsx' ('name="' + $r + '"')
}
Say ""
Say "--- WIRING: admin dashboard tiles (AdminDashboardScreen.tsx) ---"
foreach ($r in 'AdminVisitors','AdminFoodMenu','AdminSupport','AdminLaundry','AdminFacilities','AdminFeedback','AdminRules') {
  TextCheck ("tile " + $r) 'AdminDashboardScreen.tsx' ("navigate('" + $r + "')")
}
Say ""
Say "--- WIRING: Home quick actions (HomeScreen.tsx / mockData.ts) ---"
foreach ($i in 'facilities','feedback','rules','laundry') {
  $hit = $allFiles | Where-Object { $_.Name -in 'mockData.ts','HomeScreen.tsx' } | Select-String -Pattern ("'" + $i + "'") -SimpleMatch -List | Select-Object -First 1
  if ($hit) { Say ("  [OK]      home action " + $i) } else { Say ("  [MISSING] home action " + $i) }
}
Say ""

Say "--- FIRESTORE RULES (local copy, if you keep one) ---"
$rulesFile = Get-ChildItem -Path $root -Filter 'firestore.rules' -File -ErrorAction SilentlyContinue | Select-Object -First 1
if ($rulesFile) {
  Say ("  using " + $rulesFile.Name + "  (the Console copy is what is really live - compare it)")
  foreach ($c in 'visitors','supportTickets','foodMenus','foodFeedback','facilities','feedback','rules','ruleAcks','laundryRequests','mealRatings','residentDocuments') {
    $hit = Select-String -Path $rulesFile.FullName -Pattern ("match /" + $c + "/") -SimpleMatch -Quiet
    if ($hit) { Say ("  [OK]      match /" + $c) } else { Say ("  [MISSING] match /" + $c) }
  }
} else { Say "  No firestore.rules file in the project. Check these collections in Firebase Console > Firestore > Rules:  visitors, supportTickets, foodMenus, foodFeedback, facilities, feedback, rules, ruleAcks, laundry" }
Say ""

Say "--- CLEAN-UP / RISK CHECKS ---"
foreach ($n in 'useNetRent.ts','readNotices.ts') {
  if (FindFile $n) { Say ("  [DELETE]  obsolete file still present: " + (FindFile $n)) } else { Say ("  [OK]      " + $n + " not present") }
}
$demo = $allFiles | Select-String -Pattern 'SHOW_DEMO_LOGINS' -SimpleMatch | Select-Object -First 3
if ($demo) { foreach ($d in $demo) { Say ("  [CHECK]   " + $d.Path.Substring($root.Length + 1) + ":" + $d.LineNumber + "  " + $d.Line.Trim()) } }
$mock = $allFiles | Select-String -Pattern "from '../../constants/mockData'" -SimpleMatch -List
Say ("  [INFO]    screens still importing mockData: " + @($mock).Count)
$todo = $allFiles | Select-String -Pattern 'Coming Soon' -SimpleMatch
Say ("  [INFO]    'Coming Soon' placeholders left: " + @($todo).Count)
foreach ($t in ($todo | Select-Object -First 8)) { Say ("            " + $t.Path.Substring($root.Length + 1) + ":" + $t.LineNumber) }
Say ""

Say "--- TYPESCRIPT CHECK (npx tsc --noEmit) ---"
$tsc = & npx tsc --noEmit 2>&1
$errs = @($tsc | Where-Object { $_ -match 'error TS' })
Say ("  TypeScript errors: " + $errs.Count)
foreach ($e in ($errs | Select-Object -First 25)) { Say ("    " + $e) }
if ($errs.Count -gt 25) { Say ("    ... and " + ($errs.Count - 25) + " more (see audit-report.txt)") ; foreach ($e in ($errs | Select-Object -Skip 25)) { $out.Add("    " + $e) } }
Say ""

Say "--- GIT ---"
$g = & git status --short 2>&1
Say ("  changed/untracked files: " + @($g).Count)
foreach ($l in ($g | Select-Object -First 40)) { Say ("    " + $l) }
Say ""
Say "=============== END ==============="

$report = Join-Path $root 'audit-report.txt'
$out | Out-File -FilePath $report -Encoding utf8
Write-Host ""
Write-Host "Report saved to: $report"
Write-Host "Paste the whole output (or attach audit-report.txt) back to Claude."
