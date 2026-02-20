# Functional Requirements   
  
  
A. Platform & Build  
* Build on WordPress with Elementor (frontend) based on Client-provided design layout / mockups.  
* A custom WordPress plugin will be developed to handle registration, attendance, seat management, QR check-in/out, and admin dashboards.  
  
**B. Admin (Backend) Functions**  
B1. Course / Session Management  
* Course Builder: Admin can create/edit courses with required fields including (but not limited to) date, time, venue mode (on-site / online / mixed), capacity, and status.  
* Course Viewer: Admin can view registration status per course, including:  
    * Candidate list view with filter/search/sort  
    * Candidate status management: Accept (On-site) / Accept (Online) / Reject  
    * Bulk update candidate status  
    * Auto-email notifications triggered by status change  
B2. Attendance Management  
* Attendance dashboard within each course to:  
    * View attendance list  
    * Mark attendance (IN / OUT) and edit records (with audit trail if required [TBC])  
    * Export attendance (e.g., CSV/Excel) [TBC format]  
B3. Seat Map & Seat Allocation  
* Seat Map Builder: Admin can create/manage seat layouts for each venue/course.  
* Seat Allocation Dashboard (interactive seat map):  
    * Assign / unassign seats to candidates  
    * Swap seats between candidates  
    * Visual indicators (e.g., different color) for candidates with check-in records  
B4. QR Code Generator & Scanner Workflow  
* System generates a unique QR code per candidate per course.  
* When an admin-logged device scans a QR code:  
    * System displays a candidate detail popup (e.g., name, email, organisation) and prompts for Confirm IN / Confirm OUT time recording (as per client sample UI).  
    * Records check-in/out timestamps and links them to the candidate + course.  
B5. Registration Rules  
* No candidate login will be implemented.  
* System allows multiple registrations using the same email for the same event; no duplicate checking will be enforced.  
  
**C. Public (Frontend) Functions**  
C1. Responsive Website Pages  
* Implement frontend pages to match the Client-provided design, with responsive behavior for desktop/tablet/mobile.  
C2. Registration Form  
* Frontend registration form to collect participant details and selected sessions (including on-site/online options where applicable).  
* After submission:  
    * Display a thank-you confirmation  
    * Send an acknowledgement email to the registrant  
    * Successful applicants will receive a unique QR code (per course/session) via email, to be presented on-site for check-in/out attendance scanning.   
C3. EDM / Email Communications  
* Admin can trigger email communications for:  
    * Submission acknowledgement  
    * Status change (accepted online / accepted on-site / rejected)  
    * EDM broadcast to registrant lists by filters [TBC: filters & segments]  
* Email templates will be configurable in admin [TBC: number of templates included].  
  
**D. Non-Functional & Compliance Requirements**  
* Develop in accordance with:  
    * W3C HTML5  
    * WCAG 2.2 Level AA  
    * IPv6-ready standard  
    * ISO/IEC 10646 (Unicode)  
* Implement site content handling to align with:  
    * Privacy Policy Statement  
    * Personal Information Collection Statement  
  
**E. Deliverables**  
* WordPress website + Elementor pages (as per approved design)  
* Custom plugin  
* Admin dashboards for course, seat, attendance, QR check-in/out, and email workflows  
* Data export in CSV for registration and attendance  
