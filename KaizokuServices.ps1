# ---- Configuration ----
# Regex matched against each service's logon account (StartName).
# Set to '' (empty) to show ALL services.
$AccountFilter = ''

Add-Type -AssemblyName PresentationFramework, PresentationCore, WindowsBase

$xaml = @"
<Window xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="Kaizoku Services" Width="780" Height="680"
        WindowStartupLocation="CenterScreen"
        Background="#1e1e2e" Foreground="#cdd6f4">
    <Window.Resources>
        <Style TargetType="Button" x:Key="ActionBtn">
            <Setter Property="Padding" Value="14,7"/>
            <Setter Property="Margin" Value="3,0"/>
            <Setter Property="FontSize" Value="12"/>
            <Setter Property="FontWeight" Value="SemiBold"/>
            <Setter Property="Cursor" Value="Hand"/>
            <Setter Property="BorderThickness" Value="0"/>
            <Setter Property="Template">
                <Setter.Value>
                    <ControlTemplate TargetType="Button">
                        <Border x:Name="bd" Background="{TemplateBinding Background}"
                                CornerRadius="5" Padding="{TemplateBinding Padding}">
                            <ContentPresenter HorizontalAlignment="Center" VerticalAlignment="Center"/>
                        </Border>
                        <ControlTemplate.Triggers>
                            <Trigger Property="IsMouseOver" Value="True">
                                <Setter TargetName="bd" Property="Opacity" Value="0.85"/>
                            </Trigger>
                            <Trigger Property="IsPressed" Value="True">
                                <Setter TargetName="bd" Property="Opacity" Value="0.7"/>
                            </Trigger>
                        </ControlTemplate.Triggers>
                    </ControlTemplate>
                </Setter.Value>
            </Setter>
        </Style>
        <Style TargetType="DataGrid">
            <Setter Property="Background" Value="#181825"/>
            <Setter Property="Foreground" Value="#cdd6f4"/>
            <Setter Property="BorderBrush" Value="#313244"/>
            <Setter Property="BorderThickness" Value="1"/>
            <Setter Property="RowBackground" Value="#1e1e2e"/>
            <Setter Property="AlternatingRowBackground" Value="#181825"/>
            <Setter Property="GridLinesVisibility" Value="Horizontal"/>
            <Setter Property="HorizontalGridLinesBrush" Value="#313244"/>
            <Setter Property="FontSize" Value="13"/>
        </Style>
        <Style TargetType="DataGridColumnHeader">
            <Setter Property="Background" Value="#313244"/>
            <Setter Property="Foreground" Value="#a6adc8"/>
            <Setter Property="Padding" Value="8,6"/>
            <Setter Property="FontWeight" Value="SemiBold"/>
            <Setter Property="FontSize" Value="12"/>
            <Setter Property="BorderBrush" Value="#45475a"/>
            <Setter Property="BorderThickness" Value="0,0,1,1"/>
        </Style>
        <Style TargetType="DataGridRow">
            <Setter Property="Foreground" Value="#cdd6f4"/>
            <Style.Triggers>
                <Trigger Property="IsSelected" Value="True">
                    <Setter Property="Background" Value="#45475a"/>
                </Trigger>
            </Style.Triggers>
        </Style>
        <Style TargetType="DataGridCell">
            <Setter Property="Padding" Value="6,4"/>
            <Setter Property="BorderThickness" Value="0"/>
            <Setter Property="FocusVisualStyle" Value="{x:Null}"/>
            <Style.Triggers>
                <Trigger Property="IsSelected" Value="True">
                    <Setter Property="Background" Value="#45475a"/>
                    <Setter Property="Foreground" Value="#cdd6f4"/>
                </Trigger>
            </Style.Triggers>
        </Style>
    </Window.Resources>

    <DockPanel Margin="12">
        <!-- Top bar: counts -->
        <StackPanel DockPanel.Dock="Top" Orientation="Horizontal" Margin="0,0,0,10">
            <TextBlock Text="Kaizoku Services" FontSize="18" FontWeight="Bold" Foreground="#cba6f7" VerticalAlignment="Center"/>
            <TextBlock x:Name="txtCounts" Margin="16,0,0,0" FontSize="13" Foreground="#a6adc8" VerticalAlignment="Center"/>
        </StackPanel>

        <!-- Button bar -->
        <WrapPanel DockPanel.Dock="Top" Margin="0,0,0,10">
            <Button x:Name="btnStart" Content="▶ Start" Style="{StaticResource ActionBtn}" Background="#a6e3a1" Foreground="#1e1e2e"/>
            <Button x:Name="btnStop" Content="⏹ Stop" Style="{StaticResource ActionBtn}" Background="#f38ba8" Foreground="#1e1e2e"/>
            <Button x:Name="btnRestart" Content="↻ Restart" Style="{StaticResource ActionBtn}" Background="#89b4fa" Foreground="#1e1e2e"/>
            <Border Width="1" Background="#45475a" Margin="8,2"/>
            <Button x:Name="btnSetAuto" Content="Set Auto" Style="{StaticResource ActionBtn}" Background="#fab387" Foreground="#1e1e2e"/>
            <Button x:Name="btnSetManual" Content="Set Manual" Style="{StaticResource ActionBtn}" Background="#f9e2af" Foreground="#1e1e2e"/>
            <Button x:Name="btnSetDisabled" Content="Set Disabled" Style="{StaticResource ActionBtn}" Background="#6c7086" Foreground="#1e1e2e"/>
            <Border Width="1" Background="#45475a" Margin="8,2"/>
            <Button x:Name="btnStartAll" Content="Start All Auto" Style="{StaticResource ActionBtn}" Background="#94e2d5" Foreground="#1e1e2e"/>
            <Button x:Name="btnRefresh" Content="⟳ Refresh" Style="{StaticResource ActionBtn}" Background="#b4befe" Foreground="#1e1e2e"/>
        </WrapPanel>

        <!-- Status bar -->
        <TextBlock x:Name="txtStatus" DockPanel.Dock="Bottom" Margin="0,8,0,0" FontSize="12"
                   Foreground="#a6adc8" FontStyle="Italic"/>

        <!-- Grid -->
        <DataGrid x:Name="grid" AutoGenerateColumns="False" IsReadOnly="True"
                  SelectionMode="Extended" SelectionUnit="FullRow"
                  CanUserSortColumns="True" CanUserReorderColumns="False"
                  HeadersVisibility="Column" VerticalScrollBarVisibility="Auto">
            <DataGrid.Columns>
                <DataGridTextColumn Header="Service Name" Binding="{Binding Name}" Width="*" MinWidth="180"/>
                <DataGridTextColumn Header="State" Binding="{Binding State}" Width="100"/>
                <DataGridTextColumn Header="Start Mode" Binding="{Binding StartMode}" Width="90"/>
                <DataGridTextColumn Header="PID" Binding="{Binding PID}" Width="65"/>
            </DataGrid.Columns>
        </DataGrid>
    </DockPanel>
</Window>
"@

# Parse XAML
$reader = [System.Xml.XmlReader]::Create([System.IO.StringReader]::new($xaml))
$window = [System.Windows.Markup.XamlReader]::Load($reader)

# Get controls
$grid       = $window.FindName('grid')
$txtCounts  = $window.FindName('txtCounts')
$txtStatus  = $window.FindName('txtStatus')
$btnStart   = $window.FindName('btnStart')
$btnStop    = $window.FindName('btnStop')
$btnRestart = $window.FindName('btnRestart')
$btnSetAuto = $window.FindName('btnSetAuto')
$btnSetManual   = $window.FindName('btnSetManual')
$btnSetDisabled = $window.FindName('btnSetDisabled')
$btnStartAll    = $window.FindName('btnStartAll')
$btnRefresh     = $window.FindName('btnRefresh')

# ---- Data loading ----
function Load-Services {
    $services = Get-CimInstance Win32_Service |
        Where-Object { -not $AccountFilter -or $_.StartName -match $AccountFilter } |
        Select-Object @{N='Name';E={$_.Name}},
                      @{N='State';E={$_.State}},
                      @{N='StartMode';E={$_.StartMode}},
                      @{N='PID';E={ if ($_.ProcessId -and $_.ProcessId -ne 0) { $_.ProcessId } else { '' } }} |
        Sort-Object Name

    $grid.ItemsSource = @($services)

    $running = ($services | Where-Object State -eq 'Running').Count
    $stopped = ($services | Where-Object State -eq 'Stopped').Count
    $txtCounts.Text = "$running running, $stopped stopped, $($services.Count) total"
}

function Get-Selected {
    $sel = $grid.SelectedItems
    if (-not $sel -or $sel.Count -eq 0) {
        $txtStatus.Text = "No services selected."
        return @()
    }
    return @($sel)
}

function Set-Status($msg) {
    $txtStatus.Text = $msg
    $window.Dispatcher.Invoke([Action]{}, [System.Windows.Threading.DispatcherPriority]::Background)
}

# ---- Button handlers ----
$btnRefresh.Add_Click({
    Set-Status "Refreshing..."
    Load-Services
    Set-Status "Refreshed."
})

$btnStart.Add_Click({
    $selected = Get-Selected
    if ($selected.Count -eq 0) { return }
    foreach ($svc in $selected) {
        Set-Status "Starting $($svc.Name)..."
        nssm start $svc.Name 2>&1 | Out-Null
    }
    Load-Services
    Set-Status "Started $($selected.Count) service(s)."
})

$btnStop.Add_Click({
    $selected = Get-Selected
    if ($selected.Count -eq 0) { return }
    foreach ($svc in $selected) {
        Set-Status "Stopping $($svc.Name)..."
        nssm stop $svc.Name 2>&1 | Out-Null
    }
    Load-Services
    Set-Status "Stopped $($selected.Count) service(s)."
})

$btnRestart.Add_Click({
    $selected = Get-Selected
    if ($selected.Count -eq 0) { return }
    foreach ($svc in $selected) {
        Set-Status "Restarting $($svc.Name)..."
        nssm stop $svc.Name 2>&1 | Out-Null
        nssm start $svc.Name 2>&1 | Out-Null
    }
    Load-Services
    Set-Status "Restarted $($selected.Count) service(s)."
})

$btnSetAuto.Add_Click({
    $selected = Get-Selected
    if ($selected.Count -eq 0) { return }
    foreach ($svc in $selected) {
        Set-CimInstance -Query "SELECT * FROM Win32_Service WHERE Name='$($svc.Name)'" -Property @{StartMode='Automatic'} -ErrorAction SilentlyContinue
        sc.exe config $svc.Name start= auto 2>&1 | Out-Null
    }
    Load-Services
    Set-Status "Set $($selected.Count) service(s) to Auto."
})

$btnSetManual.Add_Click({
    $selected = Get-Selected
    if ($selected.Count -eq 0) { return }
    foreach ($svc in $selected) {
        sc.exe config $svc.Name start= demand 2>&1 | Out-Null
    }
    Load-Services
    Set-Status "Set $($selected.Count) service(s) to Manual."
})

$btnSetDisabled.Add_Click({
    $selected = Get-Selected
    if ($selected.Count -eq 0) { return }
    foreach ($svc in $selected) {
        nssm stop $svc.Name 2>&1 | Out-Null
        sc.exe config $svc.Name start= disabled 2>&1 | Out-Null
    }
    Load-Services
    Set-Status "Disabled $($selected.Count) service(s)."
})

$btnStartAll.Add_Click({
    Set-Status "Starting all stopped Auto services..."
    $stopped = $grid.ItemsSource | Where-Object { $_.State -eq 'Stopped' -and $_.StartMode -eq 'Auto' }
    $count = 0
    foreach ($svc in $stopped) {
        Set-Status "Starting $($svc.Name)..."
        nssm start $svc.Name 2>&1 | Out-Null
        $count++
    }
    Load-Services
    Set-Status "Started $count service(s)."
})

# ---- Initial load ----
Load-Services
$txtStatus.Text = "Ready. Select services and use the buttons above. Ctrl+Click or Shift+Click to multi-select."

$window.ShowDialog() | Out-Null
